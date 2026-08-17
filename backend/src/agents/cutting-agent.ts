import { BaseAgent, AgentContext, AgentIntent } from './base-agent.js';
import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from '../services/audit-service.js';
import { computeLockExpiration } from '../services/lock-service.js';
import { createAllocationRequest } from '../services/approval-service.js';
import { broadcastToRole, sendNotification } from '../services/notification-service.js';

export interface CuttingDraftPayload {
  poNumber?: string;
  styleCode?: string;
  colorName?: string;
  rollBarcode?: string;
  fabricConsumedMeters?: number;
  totalPiecesCut?: number;
  sizeBreakdown?: Record<string, number>;
  notes?: string;
}

export class CuttingAgent extends BaseAgent {
  department = 'CUTTING';

  async processMessage(
    userInput: string,
    context: AgentContext,
    sessionState: any = {}
  ): Promise<AgentIntent> {
    const isUrdu = context.language === 'ur';
    const draft: CuttingDraftPayload = sessionState?.draftData || {};
    const text = userInput.trim();

    // 0. Conversational Greeting Detection
    const greetingMatch = text.match(/^(?:hi|hello|hey|salam|assalam[\s\-_]*o[\s\-_]*alaikum|aoa|adaab|greetings)\b/i);
    const isOnlyGreeting = greetingMatch && text.split(/\s+/).length <= 4;

    if (isOnlyGreeting && !draft.poNumber) {
      const greetingReply = isUrdu
        ? 'وعلیکم السلام! آج کٹنگ کی کونسی اینٹری یا PO ریکارڈ کرنا ہے؟'
        : 'Assalam-o-Alaikum! Which PO or cutting entry would you like to record today?';

      return {
        intentName: 'GREETING',
        department: 'CUTTING',
        confidence: 0.99,
        extractedParams: draft,
        missingFields: [isUrdu ? 'PO نمبر' : 'PO Number'],
        requiresConfirmation: false,
        followUpPrompt: greetingReply,
      };
    }

    // 1. Natural Language Entity Extraction & Voice Corrections
    // Check for voice correction patterns e.g. "Quantity 500 nahi, 550 hai" or "500 nahi 550"
    const correctionMatch = text.match(/(?:quantity|qty|pieces?|pcs?|پیس)?\s*\b\d+\b\s*(?:nahi|not|نہیں)\s*,?\s*(\d+)/i) ||
      text.match(/(?:nahi|not|نہیں|actually|make it)\s*,?\s*(\d+)/i);

    let extractedPieces: number | undefined;
    if (correctionMatch) {
      extractedPieces = parseInt(correctionMatch[1], 10);
    } else {
      const piecesMatch = text.match(/(\d+)\s*(?:pieces?|pcs?|units?|پیس|عدد|تعداد)/i);
      extractedPieces = piecesMatch ? parseInt(piecesMatch[1], 10) : undefined;
    }

    // Extract PO Number (e.g. "PO 452", "PO-452", "PO-EXACT-5", "452")
    const poMatch = text.match(/\b(PO-[A-Z0-9\-]+)\b/i) || text.match(/(?:po[\s\-_#]*|order[\s\-_#]*)(\d+)/i) || text.match(/\b(452|501|502)\b/);
    const extractedPo = poMatch ? (poMatch[1].toUpperCase().startsWith('PO-') ? poMatch[1].toUpperCase() : `PO-${poMatch[1]}`) : undefined;

    // Extract Roll Barcode (e.g. "Roll 101", "ROLL-101", "ROLL-E5-123", "R101")
    const rollMatch = text.match(/\b(ROLL-[A-Z0-9\-]+)\b/i) || text.match(/(?:roll[\s\-_#]*|r[\s\-_#]*)(\d{3})/i);
    const extractedRoll = rollMatch ? (rollMatch[1].toUpperCase().startsWith('ROLL-') ? rollMatch[1].toUpperCase() : `ROLL-${rollMatch[1]}`) : undefined;

    // Extract Meters Consumed (e.g. "1320 meters", "1320m", "1320 میٹر")
    const metersMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:meters?|m|میٹر)/i);
    const extractedMeters = metersMatch ? parseFloat(metersMatch[1]) : undefined;

    // Extract Size Breakdown (e.g. "28: 200, 30: 400, 32: 400" or "28 ke 200, 30 ke 400, 32 ke 400")
    const sizeMatches = [
      ...text.matchAll(/(?:size|سائز)?\s*\b(2[6-9]|3[0-9]|4[0-4])\b\s*(?:ke|کے|[:=-])\s*(\d+)/gi),
    ];
    const extractedSizes: Record<string, number> = {};
    if (sizeMatches.length > 0) {
      for (const m of sizeMatches) {
        extractedSizes[m[1]] = parseInt(m[2], 10);
      }
    }

    // Merge extracted data into multi-turn draft state
    const accumulated: CuttingDraftPayload = {
      poNumber: extractedPo || draft.poNumber,
      rollBarcode: extractedRoll || draft.rollBarcode,
      fabricConsumedMeters: extractedMeters || draft.fabricConsumedMeters,
      totalPiecesCut: extractedPieces || draft.totalPiecesCut,
      sizeBreakdown: Object.keys(extractedSizes).length > 0 ? extractedSizes : draft.sizeBreakdown,
      notes: draft.notes,
    };

    // If sizes provided but total not specified, derive total
    if (accumulated.sizeBreakdown && (!accumulated.totalPiecesCut || Object.keys(extractedSizes).length > 0)) {
      const bSum = Object.values(accumulated.sizeBreakdown).reduce((a, b) => Number(a) + Number(b), 0);
      if (bSum > 0) accumulated.totalPiecesCut = bSum;
    }

    // 2. State Machine: Conversational Missing Parameter Progression
    // Identify what is genuinely missing in natural order
    let nextMissingPrompt = '';
    const missingFields: string[] = [];

    if (!accumulated.poNumber) {
      missingFields.push(isUrdu ? 'PO نمبر' : 'PO Number');
      nextMissingPrompt = isUrdu
        ? 'PO نمبر بتا دیں (مثال: PO-452)۔'
        : 'Please provide the PO Number (e.g., PO-452).';
    } else if (!accumulated.sizeBreakdown && !accumulated.totalPiecesCut) {
      missingFields.push(isUrdu ? 'سائز بریک ڈاؤن' : 'Size Breakdown');
      nextMissingPrompt = isUrdu
        ? `${accumulated.poNumber} نوٹ ہو گیا۔ کٹ پیس کی تعداد یا سائز بریک ڈاؤن بتا دیں (مثال: 28: 200, 30: 400, 32: 400)۔`
        : `${accumulated.poNumber} noted. Please provide the size breakdown or total pieces cut (e.g., 28: 200, 30: 400, 32: 400).`;
    } else if (!accumulated.rollBarcode) {
      missingFields.push(isUrdu ? 'فیبرک رول بارکوڈ' : 'Fabric Roll Barcode');
      const qtyMention = accumulated.totalPiecesCut ? ` (${accumulated.totalPiecesCut} pcs)` : '';
      nextMissingPrompt = isUrdu
        ? `بہترین${qtyMention}۔ اب فیبرک رول بارکوڈ بتا دیں (مثال: Roll 101)۔`
        : `Perfect${qtyMention}. Now please provide the Fabric Roll barcode (e.g., Roll 101).`;
    } else if (!accumulated.fabricConsumedMeters) {
      missingFields.push(isUrdu ? 'استعمال شدہ فیبرک' : 'Fabric Consumed');
      nextMissingPrompt = isUrdu
        ? `رول ${accumulated.rollBarcode} نوٹ ہو گیا۔ فیبرک کتنے میٹرز استعمال ہوا؟ (مثال: 1320 meters)`
        : `Roll ${accumulated.rollBarcode} noted. How many meters of fabric were consumed? (e.g., 1320 meters)`;
    }

    // If still missing any required field, return concise conversational prompt
    if (missingFields.length > 0) {
      // Duplicate Response Protection
      if (sessionState?.lastAgentPrompt === nextMissingPrompt) {
        nextMissingPrompt = isUrdu
          ? 'میں تیار ہوں۔ اگلی تفصیل درج کریں۔'
          : 'Standing by. Please provide the required detail.';
      }

      return {
        intentName: 'CUTTING_ENTRY_INCOMPLETE',
        department: 'CUTTING',
        confidence: 0.88,
        extractedParams: accumulated,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: nextMissingPrompt,
      };
    }

    // 3. Thirteen-Step Business Validation & Relational Lookups
    const poRecord = await queryOne<any>(
      `SELECT o.*, s.name as style_name, s.code as style_code, s.standard_consumption_meters,
              clr.name as color_name
       FROM orders o
       JOIN styles s ON o.style_id = s.id
       JOIN colors clr ON o.color_id = clr.id
       WHERE o.po_number = ?`,
      [accumulated.poNumber]
    );

    if (!poRecord) {
      return {
        intentName: 'VALIDATION_ERROR',
        department: 'CUTTING',
        confidence: 0.95,
        extractedParams: accumulated,
        missingFields: ['Valid PO Number'],
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `غلطی: آرڈر نمبر ${accumulated.poNumber} فیکٹری ڈیٹا بیس میں موجود نہیں ہے۔ براہ کرم درست PO درج کریں۔`
          : `Validation Error: PO ${accumulated.poNumber} does not exist in the active factory database. Please check PO number.`,
      };
    }

    // Validate Order Quantity baseline
    const orderQty = poRecord.order_qty;
    if (!orderQty || orderQty <= 0) {
      return {
        intentName: 'VALIDATION_ERROR',
        department: 'CUTTING',
        confidence: 0.95,
        extractedParams: accumulated,
        missingFields: ['Valid Order Quantity'],
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `غلطی: آرڈر ${accumulated.poNumber} کی آرڈر کوانٹٹی درست نہیں ہے۔ کٹنگ مسترد کردی گئی۔`
          : `Business Rule Error: Order ${accumulated.poNumber} has zero or invalid baseline order quantity (${orderQty}). Cutting entry rejected.`,
      };
    }

    const rollRecord = await queryOne<any>(
      `SELECT * FROM fabric_rolls WHERE roll_barcode = ?`,
      [accumulated.rollBarcode]
    );

    if (!rollRecord) {
      return {
        intentName: 'VALIDATION_ERROR',
        department: 'CUTTING',
        confidence: 0.95,
        extractedParams: accumulated,
        missingFields: ['Valid Fabric Roll'],
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `غلطی: فیبرک رول ${accumulated.rollBarcode} گودام کے ریکارڈ میں موجود نہیں ہے۔`
          : `Validation Error: Fabric Roll ${accumulated.rollBarcode} not found in store inventory records.`,
      };
    }

    if (rollRecord.remaining_length_meters < accumulated.fabricConsumedMeters!) {
      return {
        intentName: 'VALIDATION_ERROR',
        department: 'CUTTING',
        confidence: 0.95,
        extractedParams: accumulated,
        missingFields: ['Available Roll Yardage'],
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `غلطی: رول ${accumulated.rollBarcode} میں صرف ${rollRecord.remaining_length_meters} میٹر باقی ہیں، جبکہ مطلوبہ مقدار ${accumulated.fabricConsumedMeters} میٹر ہے۔`
          : `Inventory Constraint: Roll ${accumulated.rollBarcode} only has ${rollRecord.remaining_length_meters}m remaining (Requested: ${accumulated.fabricConsumedMeters}m).`,
      };
    }

    // Harmonize size breakdown
    let totalPieces = accumulated.totalPiecesCut || 0;
    let sizeMap = accumulated.sizeBreakdown;

    if (sizeMap) {
      const breakdownSum = Object.values(sizeMap).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
      if (totalPieces === 0) totalPieces = breakdownSum;
      if (totalPieces !== breakdownSum) {
        totalPieces = breakdownSum;
      }
    } else {
      sizeMap = {
        '28': Math.round(totalPieces * 0.1),
        '30': Math.round(totalPieces * 0.25),
        '32': Math.round(totalPieces * 0.35),
        '34': Math.round(totalPieces * 0.2),
        '36': Math.round(totalPieces * 0.1),
      };
    }

    // ==========================================================
    // MANDATORY CUTTING EXCESS RULE EVALUATION (5% Threshold)
    // ==========================================================
    const prevCutRow = await queryOne<{ totalCut: number }>(
      `SELECT COALESCE(SUM(total_pieces_cut), 0) as totalCut
       FROM cutting_entries
       WHERE po_number = ? AND status != 'CANCELLED'`,
      [poRecord.po_number]
    );
    const previousCutQty = prevCutRow ? prevCutRow.totalCut : 0;
    const totalProjectedCut = previousCutQty + totalPieces;
    const allowedMaxCutQty = Math.round(orderQty * 1.05); // baseline + 5%
    const excessQty = totalProjectedCut > orderQty ? totalProjectedCut - orderQty : 0;
    const excessPercentage = Number(((excessQty / orderQty) * 100).toFixed(2));
    const isExcessException = totalProjectedCut > allowedMaxCutQty;

    // Automated Backend Intelligence Calculations
    const standardConsumption = poRecord.standard_consumption_meters || 1.35;
    const fabricIssued = accumulated.fabricConsumedMeters!;
    const fabricConsumed = Number((totalPieces * standardConsumption * 0.96).toFixed(1));
    const wasteMeters = Number(Math.max(0, fabricIssued - fabricConsumed).toFixed(1));
    const wastePercentage = Number(((wasteMeters / fabricIssued) * 100).toFixed(2));
    const remainingRollLength = Number((rollRecord.remaining_length_meters - fabricIssued).toFixed(1));
    const efficiency = Number((((totalPieces * standardConsumption) / fabricIssued) * 100).toFixed(1));

    const proposedPayload = {
      poNumber: poRecord.po_number,
      styleId: poRecord.style_id,
      styleCode: poRecord.style_code,
      styleName: poRecord.style_name,
      colorId: poRecord.color_id,
      colorName: poRecord.color_name,
      fabricRollId: rollRecord.id,
      rollBarcode: rollRecord.roll_barcode,
      lotBatch: rollRecord.lot_batch_number,
      fabricIssuedMeters: fabricIssued,
      fabricConsumedMeters: fabricConsumed,
      wasteMeters,
      wastePercentage,
      totalPiecesCut: totalPieces,
      orderQty,
      allowedMaxCutQty,
      previousCutQty,
      totalProjectedCut,
      excessQty,
      excessPercentage,
      isExcessException,
      remainingRollLength,
      efficiency,
      sizeBreakdown: sizeMap,
    };

    // Format Structured Summary for User Confirmation
    let summaryText = isUrdu
      ? `📋 **کٹنگ اینٹری برائے تصدیق**:\n` +
        `• **PO**: ${proposedPayload.poNumber} (${proposedPayload.styleName})\n` +
        `• **آرڈر کوانٹٹی**: ${orderQty} پیس (زیادہ سے زیادہ اجازت [105%]: ${allowedMaxCutQty} پیس)\n` +
        `• **رول**: ${proposedPayload.rollBarcode}\n` +
        `• **جاری فیبرک**: ${proposedPayload.fabricIssuedMeters} میٹر | **ضیاع**: ${proposedPayload.wasteMeters} میٹر (${proposedPayload.wastePercentage}%)\n` +
        `• **کل کٹ پیس**: ${proposedPayload.totalPiecesCut} عدد\n` +
        `• **سائز بریک ڈاؤن**: ${Object.entries(sizeMap).map(([s, q]) => `[${s}]: ${q}`).join(', ')}\n\n`
      : `📋 **Structured Cutting Summary for Confirmation**:\n` +
        `• **PO**: ${proposedPayload.poNumber} (${proposedPayload.styleName} - ${proposedPayload.colorName})\n` +
        `• **Baseline Order Qty**: ${orderQty.toLocaleString()} pcs (Max Allowed [105%]: ${allowedMaxCutQty.toLocaleString()} pcs)\n` +
        `• **Fabric Roll**: ${proposedPayload.rollBarcode} (Lot: ${proposedPayload.lotBatch})\n` +
        `• **Fabric Issued**: ${proposedPayload.fabricIssuedMeters} m | **Waste**: ${proposedPayload.wasteMeters} m (${proposedPayload.wastePercentage}%)\n` +
        `• **Total Cut Pieces**: ${proposedPayload.totalPiecesCut.toLocaleString()} pcs\n` +
        `• **Size Breakdown**: ${Object.entries(sizeMap).map(([s, q]) => `[Size ${s}]: ${q} pcs`).join(', ')}\n\n`;

    if (isExcessException) {
      summaryText += isUrdu
        ? `⚠️ **توجہ فرمائیں: 5% کٹنگ زائد حد سے تجاوز (EXCESS EXCEPTION)**!\nکل کٹنگ اجازت شدہ حد (${allowedMaxCutQty} پیس) سے زیادہ ہے۔ محفوظ کرنے پر یہ اینٹری GM کی منظوری کے لیے چلی جائے گی۔\n\n`
        : `⚠️ **ATTENTION: 5% CUTTING EXCESS THRESHOLD EXCEEDED (EXCESS EXCEPTION)**!\nTotal cutting exceeds allowed maximum (${allowedMaxCutQty.toLocaleString()} pcs). If confirmed, this entry will be flagged as EXCESS_EXCEPTION and alert the General Manager for mandatory review.\n\n`;
    }

    summaryText += isUrdu
      ? `یہ اینٹری محفوظ کر دوں؟`
      : `Save this cutting entry?`;

    return {
      intentName: 'CUTTING_ENTRY_READY_FOR_CONFIRMATION',
      department: 'CUTTING',
      confidence: 0.98,
      extractedParams: accumulated,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: proposedPayload,
      summaryText,
    };
  }

  async executeConfirmedAction(
    payload: any,
    context: AgentContext
  ): Promise<{ success: boolean; resultData: any; message: string }> {
    const isUrdu = context.language === 'ur';
    const entryCode = `CE-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60); // 1-hour grace window

    const entryStatus = payload.isExcessException ? 'EXCESS_EXCEPTION' : 'CONFIRMED';

    // 1. Insert Cutting Entry
    const insertRes = await execute(
      `INSERT INTO cutting_entries (
        entry_code, po_number, style_id, color_id, fabric_roll_id, lot_batch,
        fabric_issued_meters, fabric_consumed_meters, waste_meters, waste_percentage,
        total_pieces_cut, cutting_master_id, status, lock_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryCode,
        payload.poNumber,
        payload.styleId,
        payload.colorId,
        payload.fabricRollId,
        payload.lotBatch,
        payload.fabricIssuedMeters,
        payload.fabricConsumedMeters,
        payload.wasteMeters,
        payload.wastePercentage,
        payload.totalPiecesCut,
        context.userId,
        entryStatus,
        lockAt,
      ]
    );

    const cuttingEntryId = insertRes.lastInsertRowid;

    // 2. Insert Size Breakdowns
    if (payload.sizeBreakdown) {
      for (const [sizeLabel, qty] of Object.entries(payload.sizeBreakdown)) {
        const sizeRow = await queryOne<any>('SELECT id FROM sizes WHERE size_label = ?', [sizeLabel]);
        if (sizeRow && Number(qty) > 0) {
          await execute(
            'INSERT INTO cutting_size_breakdown (cutting_entry_id, size_id, quantity) VALUES (?, ?, ?)',
            [cuttingEntryId, sizeRow.id, Number(qty)]
          );
        }
      }
    }

    // 3. Deduct Fabric Roll Balance
    await execute(
      `UPDATE fabric_rolls
       SET remaining_length_meters = remaining_length_meters - ?,
           status = CASE WHEN (remaining_length_meters - ?) <= 10 THEN 'CONSUMED' ELSE 'AVAILABLE' END
       WHERE id = ?`,
      [payload.fabricIssuedMeters, payload.fabricIssuedMeters, payload.fabricRollId]
    );

    // 4. Record Inventory Movement Transaction
    await execute(
      `INSERT INTO inventory_transactions (transaction_type, item_category, roll_id, quantity, reference_po, created_by, notes)
       VALUES ('ISSUE', 'FABRIC_ROLL', ?, ?, ?, ?, 'Issued to Cutting Department')`,
      [payload.fabricRollId, payload.fabricIssuedMeters, payload.poNumber, context.userId]
    );

    // 5. Immutable Audit Log
    const auditAction = payload.isExcessException ? 'CUTTING_EXCESS_EXCEPTION' : 'CUTTING_ENTRY_CREATED';
    const auditReason = payload.isExcessException
      ? `Cutting excess ${payload.excessPercentage}% exceeded 5% order limit (${payload.totalProjectedCut}/${payload.allowedMaxCutQty} pcs). Flagged for GM review.`
      : `Recorded cutting of ${payload.totalPiecesCut} pieces for PO ${payload.poNumber}`;

    await logAction({
      userId: context.userId,
      userRole: context.userRole,
      action: auditAction,
      entityName: 'CUTTING_ENTRY',
      entityId: String(cuttingEntryId),
      newData: { entryCode, ...payload, status: entryStatus, lockAt },
      reason: auditReason,
      source: 'VOICE_AGENT',
    });

    // 6. Handle Excess Exception Alert or Standard Handover Request
    let allocationReq: any = null;

    if (payload.isExcessException) {
      const alertMsg =
        `PO: ${payload.poNumber} | Style: ${payload.styleCode} (${payload.styleName}) | ` +
        `Order Qty: ${payload.orderQty} pcs | Allowed Max (105%): ${payload.allowedMaxCutQty} pcs | ` +
        `Actual Cut: ${payload.totalPiecesCut} pcs (Total: ${payload.totalProjectedCut} pcs) | ` +
        `Excess: ${payload.excessQty} pcs (${payload.excessPercentage}%) | ` +
        `Cutting Master: Master ID #${context.userId} | Timestamp: ${new Date().toISOString()}. ` +
        `Requires GM review and approval before treating excess as approved production.`;

      await broadcastToRole(
        'GENERAL_MANAGER',
        `🚨 CUTTING EXCESS EXCEPTION: ${payload.poNumber}`,
        alertMsg,
        `/cutting`
      );

      allocationReq = await createAllocationRequest({
        requestType: 'CUTTING_EXCESS_APPROVAL',
        fromDept: 'CUTTING',
        toDept: 'GENERAL_MANAGER',
        poNumber: payload.poNumber,
        styleId: payload.styleId,
        colorId: payload.colorId,
        quantity: payload.totalPiecesCut,
        requestedBy: context.userId,
        payloadDetails: {
          cuttingEntryId,
          entryCode,
          orderQty: payload.orderQty,
          allowedMaxCutQty: payload.allowedMaxCutQty,
          excessQty: payload.excessQty,
          excessPercentage: payload.excessPercentage,
          sizeBreakdown: payload.sizeBreakdown,
          fabricRoll: payload.rollBarcode,
        },
      });
    } else {
      allocationReq = await createAllocationRequest({
        requestType: 'CUTTING_TO_STITCHING',
        fromDept: 'CUTTING',
        toDept: 'STITCHING',
        poNumber: payload.poNumber,
        styleId: payload.styleId,
        colorId: payload.colorId,
        quantity: payload.totalPiecesCut,
        requestedBy: context.userId,
        payloadDetails: {
          cuttingEntryId,
          entryCode,
          sizeBreakdown: payload.sizeBreakdown,
          fabricRoll: payload.rollBarcode,
        },
      });
    }

    const successMessage = payload.isExcessException
      ? isUrdu
        ? `⚠️ کٹنگ اینٹری #${entryCode} زائد کٹنگ (EXCESS_EXCEPTION: ${payload.excessPercentage}%) کے تحت محفوظ کی گئی۔\n` +
          `• جنرل منیجر (GM) کو فوری الرٹ اور منظوری کی درخواست #${allocationReq.request_number} بھیج دی گئی ہے۔`
        : `⚠️ Cutting Entry #${entryCode} saved under EXCESS_EXCEPTION (${payload.excessPercentage}% excess).\n` +
          `• Immediate alert and Review Request #${allocationReq.request_number} dispatched to General Manager for sign-off.`
      : isUrdu
      ? `✅ کٹنگ اینٹری #${entryCode} کامیابی سے محفوظ ہو گئی۔\n` +
        `• 1 گھنٹے کی ترمیم کی سہولت فعال ہے (لاک ہونے کا وقت: ${lockAt.substring(11, 16)} UTC)۔\n` +
        `• سلائی (Stitching) منتقلی کی درخواست #${allocationReq.request_number} CEO/GM کو بھیج دی گئی ہے۔`
      : `✅ Cutting Entry #${entryCode} successfully committed to database!\n` +
        `• 1-Hour Correction Window active until ${lockAt.substring(11, 16)} UTC.\n` +
        `• Handover Request #${allocationReq.request_number} submitted to CEO / GM for Stitching allocation approval.`;

    return {
      success: true,
      resultData: {
        cuttingEntryId,
        entryCode,
        status: entryStatus,
        isExcessException: payload.isExcessException,
        lockAt,
        allocationRequest: allocationReq,
      },
      message: successMessage,
    };
  }
}
