import { BaseAgent, AgentContext, AgentIntent } from './base-agent.js';
import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from '../services/audit-service.js';
import { computeLockExpiration } from '../services/lock-service.js';
import { createAllocationRequest } from '../services/approval-service.js';
import { broadcastToRole, sendNotification } from '../services/notification-service.js';
import { recordMasterWageAccrual } from '../services/finance-service.js';
import { recordInventoryMovement } from '../services/store-service.js';

// ==========================================================
// 1. ORDER / MERCHANDISING AGENT
// ==========================================================
export class OrderMerchandisingAgent extends BaseAgent {
  department = 'MERCHANDISING';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*|order[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const styleMatch = text.match(/([Jj][\s\-_]?\d{3})/i);
    if (styleMatch && !draft.styleCode) draft.styleCode = styleMatch[1].toUpperCase().replace(/\s+/, '-');

    const qtyMatch = text.match(/(\d+)\s*(?:pieces?|pcs?|units?|پیس|تعداد)/i);
    if (qtyMatch && !draft.orderQty) draft.orderQty = parseInt(qtyMatch[1], 10);

    const priceMatch = text.match(/(?:\$|usd|price)[\s:=]*(\d+(?:\.\d{2})?)/i);
    if (priceMatch && !draft.unitPrice) draft.unitPrice = parseFloat(priceMatch[1]);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.styleCode) missingFields.push('Style Code');
    if (!draft.orderQty) missingFields.push('Total Order Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'ORDER_INTAKE_INCOMPLETE',
        department: 'MERCHANDISING',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `براہ کرم نئے آرڈر کی معلومات فراہم کریں: ${missingFields.join(', ')}۔ مثال: "PO 650، Style J-801، 5000 پیس برائے کسٹمر لیویز"`
          : `Please specify ${missingFields.join(', ')}. (e.g., "PO 650, Style J-801, 5000 pcs for Levi's Europe at $16.50")`,
      };
    }

    const payload = {
      poNumber: draft.poNumber,
      styleCode: draft.styleCode,
      customerName: "Levi's Strauss Europe",
      orderQty: draft.orderQty,
      unitPrice: draft.unitPrice || 16.50,
      targetDeliveryDate: '2026-11-15',
      fabricSpec: '12oz Indigo Stretch Denim, Ring Spun',
      accessoriesSpec: 'YKK Brass Zippers, Zillion Gunmetal Rivets',
      sizeBreakdown: { '28': Math.round(draft.orderQty * 0.1), '30': Math.round(draft.orderQty * 0.25), '32': Math.round(draft.orderQty * 0.35), '34': Math.round(draft.orderQty * 0.2), '36': Math.round(draft.orderQty * 0.1) },
    };

    const summaryText = isUrdu
      ? `📋 **نئے کسٹمر آرڈر کی سمری برائے تصدیق**:\n• **PO**: ${payload.poNumber}\n• **اسٹائل**: ${payload.styleCode}\n• **تعداد**: ${payload.orderQty} پیس (قیمت: $${payload.unitPrice}/pc)\n• **ڈیلیوری کی تاریخ**: ${payload.targetDeliveryDate}\n\nکیا آپ اس آرڈر کو مرچنڈائزر اور CEO کی منظوری کے لیے جمع کرانا چاہتے ہیں؟`
      : `📋 **Customer Order Draft for Confirmation**:\n• **PO**: ${payload.poNumber}\n• **Style**: ${payload.styleCode}\n• **Order Volume**: ${payload.orderQty} pcs ($${payload.unitPrice}/pc)\n• **Delivery Target**: ${payload.targetDeliveryDate}\n• **Dual Approval**: Requires Merchandising Review + CEO Final Sign-off.\n\nConfirm order intake submission?`;

    return {
      intentName: 'ORDER_READY_FOR_CONFIRMATION',
      department: 'MERCHANDISING',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const styleRow = await queryOne('SELECT id FROM styles WHERE code = ?', [payload.styleCode]) || await queryOne('SELECT id FROM styles LIMIT 1');
    const styleId = styleRow ? styleRow.id : 1;

    const res = await execute(
      `INSERT INTO orders (po_number, customer_id, style_id, color_id, order_qty, unit_price, target_delivery_date, fabric_requirement_spec, accessories_spec, status, merch_approved_by, merch_approved_at)
       VALUES (?, 1, ?, 1, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, CURRENT_TIMESTAMP)`,
      [payload.poNumber, styleId, payload.orderQty, payload.unitPrice, payload.targetDeliveryDate, payload.fabricSpec, payload.accessoriesSpec, context.userId]
    );

    const orderId = res.lastInsertRowid;

    for (const [sizeLabel, qty] of Object.entries(payload.sizeBreakdown)) {
      const sizeRow = await queryOne<any>('SELECT id FROM sizes WHERE size_label = ?', [sizeLabel]);
      if (sizeRow) {
        await execute('INSERT INTO order_size_breakdowns (order_id, size_id, quantity) VALUES (?, ?, ?)', [orderId, sizeRow.id, Number(qty)]);
      }
    }

    await broadcastToRole('CEO', `New Order ${payload.poNumber} Pending CEO Approval`, `Merchandiser has approved BOM for ${payload.poNumber} (${payload.orderQty} pcs). Requires final CEO sign-off.`);

    await logAction({
      userId: context.userId,
      userRole: context.userRole,
      action: 'ORDER_INTAKE_SUBMITTED',
      entityName: 'ORDER',
      entityId: String(orderId),
      newData: payload,
      reason: 'Order intake verified by Merchandiser and sent for CEO approval',
    });

    return {
      success: true,
      resultData: { orderId, poNumber: payload.poNumber },
      message: `Order #${payload.poNumber} created and signed by Merchandiser. Dispatched to CEO for final approval.`,
    };
  }
}

// ==========================================================
// 2. ERP / PROCUREMENT AGENT
// ==========================================================
export class ErpProcurementAgent extends BaseAgent {
  department = 'PROCUREMENT';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    let itemType = 'FABRIC';
    if (/zipper|brass\s+zip/i.test(text)) itemType = 'ZIPPER';
    if (/button|rivet/i.test(text)) itemType = 'BUTTON';
    if (/thread/i.test(text)) itemType = 'THREAD';
    if (/carton|packaging/i.test(text)) itemType = 'PACKAGING';
    draft.itemType = itemType;

    const qtyMatch = text.match(/(\d+)\s*(?:meters?|m|pcs?|units?|میٹر|عدد)/i);
    if (qtyMatch && !draft.quantity) draft.quantity = parseInt(qtyMatch[1], 10);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('Target PO Reference');
    if (!draft.quantity) missingFields.push('Procurement Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'PROCUREMENT_INCOMPLETE',
        department: 'PROCUREMENT',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please provide ${missingFields.join(', ')} (e.g. "Order 3000m Fabric for PO 452 from Naveena Denim on 30 days terms")`,
      };
    }

    const payload = {
      poReference: `PUR-${draft.poNumber}-${Date.now().toString().substring(7)}`,
      supplierId: 2,
      supplierName: 'Naveena Denim Mills (NDM)',
      targetPo: draft.poNumber,
      itemType: draft.itemType,
      description: `${draft.itemType} for production order ${draft.poNumber}`,
      quantity: draft.quantity,
      unit: draft.itemType === 'FABRIC' ? 'METERS' : 'PCS',
      unitPrice: draft.itemType === 'FABRIC' ? 4.20 : 0.45,
      totalAmount: Number((draft.quantity * (draft.itemType === 'FABRIC' ? 4.20 : 0.45)).toFixed(2)),
      paymentTermsDays: 30,
      expectedDelivery: '2026-09-05',
    };

    return {
      intentName: 'PROCUREMENT_READY_FOR_CONFIRMATION',
      department: 'PROCUREMENT',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Purchase Order Draft**:\n• **PO Ref**: ${payload.poReference}\n• **Supplier**: ${payload.supplierName}\n• **Material**: ${payload.itemType} (${payload.quantity} ${payload.unit})\n• **Total Amount**: $${payload.totalAmount.toLocaleString()} (${payload.paymentTermsDays} Days Terms)\n• **Expected Delivery**: ${payload.expectedDelivery}\n\nConfirm purchase order issuance?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const res = await execute(
      `INSERT INTO purchase_orders (po_reference, supplier_id, item_type, description, quantity, unit, unit_price, total_amount, payment_terms_days, expected_delivery, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED')`,
      [payload.poReference, payload.supplierId, payload.itemType, payload.description, payload.quantity, payload.unit, payload.unitPrice, payload.totalAmount, payload.paymentTermsDays, payload.expectedDelivery]
    );

    // Record invoice in supplier payables
    const invNo = `INV-${payload.poReference.substring(4)}`;
    await execute(
      `INSERT INTO supplier_invoices (invoice_number, supplier_id, po_reference, invoice_amount, payment_terms_days, invoice_date, due_date, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, DATE('now'), DATE('now', '+30 days'), 0, 'PENDING')`,
      [invNo, payload.supplierId, payload.targetPo, payload.totalAmount, payload.paymentTermsDays]
    );

    await logAction({
      userId: context.userId,
      userRole: context.userRole,
      action: 'PURCHASE_ORDER_ISSUED',
      entityName: 'PURCHASE_ORDER',
      entityId: String(res.lastInsertRowid),
      newData: payload,
      reason: `Procured ${payload.quantity} ${payload.unit} of ${payload.itemType}`,
    });

    return {
      success: true,
      resultData: { poReference: payload.poReference, invoiceNumber: invNo },
      message: `Purchase Order #${payload.poReference} issued. Supplier Invoice #${invNo} booked with ${payload.paymentTermsDays} days payment terms.`,
    };
  }
}

// ==========================================================
// 3. STORE & INVENTORY AGENT
// ==========================================================
export class StoreAgent extends BaseAgent {
  department = 'STORE';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';
    const draft = { ...(sessionState.draftData || {}) };

    const rollMatch = text.match(/(?:roll[\s\-_#]*|r[\s\-_#]*)(\d{3})/i);
    if (rollMatch && !draft.rollBarcode) draft.rollBarcode = `ROLL-${rollMatch[1]}`;

    const metersMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:meters?|m|میٹر)/i);
    if (metersMatch && !draft.quantity) draft.quantity = parseFloat(metersMatch[1]);

    const isIssue = /issue|جاری|کٹنگ/i.test(text);
    draft.movementType = isIssue ? 'ISSUE' : 'IN';

    const missingFields: string[] = [];
    if (!draft.rollBarcode) missingFields.push('Fabric Roll Barcode');
    if (!draft.quantity) missingFields.push('Yardage / Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'STORE_INCOMPLETE',
        department: 'STORE',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please state ${missingFields.join(', ')} (e.g. "Issue Roll 101, 1320 meters to Cutting")`,
      };
    }

    const roll = await queryOne<any>('SELECT * FROM fabric_rolls WHERE roll_barcode = ?', [draft.rollBarcode]);
    if (!roll) {
      return {
        intentName: 'ROLL_NOT_FOUND',
        department: 'STORE',
        confidence: 0.9,
        extractedParams: draft,
        missingFields: ['Valid Roll Barcode'],
        requiresConfirmation: false,
        followUpPrompt: `Fabric roll ${draft.rollBarcode} not found in warehouse inventory.`,
      };
    }

    if (draft.movementType === 'ISSUE' && roll.remaining_length_meters < draft.quantity) {
      return {
        intentName: 'INSUFFICIENT_STOCK',
        department: 'STORE',
        confidence: 0.95,
        extractedParams: draft,
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: `Negative Stock Blocked: Roll ${roll.roll_barcode} only has ${roll.remaining_length_meters}m remaining (Attempted: ${draft.quantity}m).`,
      };
    }

    const payload = {
      rollId: roll.id,
      rollBarcode: roll.roll_barcode,
      fabricType: roll.fabric_type,
      movementType: draft.movementType,
      quantity: draft.quantity,
      currentBalance: roll.remaining_length_meters,
      projectedBalance: draft.movementType === 'ISSUE' ? roll.remaining_length_meters - draft.quantity : roll.remaining_length_meters + draft.quantity,
      location: roll.warehouse_location,
    };

    return {
      intentName: 'STORE_READY_FOR_CONFIRMATION',
      department: 'STORE',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Store Inventory Transaction**:\n• **Roll**: ${payload.rollBarcode} (${payload.fabricType})\n• **Action**: ${payload.movementType} ${payload.quantity} meters\n• **Projected Remaining Yardage**: ${payload.projectedBalance}m\n\nConfirm warehouse stock transaction?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const res = await recordInventoryMovement({
      transactionType: payload.movementType,
      itemCategory: 'FABRIC_ROLL',
      rollId: payload.rollId,
      quantity: payload.quantity,
      userId: context.userId,
      userRole: context.userRole,
      notes: `Store agent logged ${payload.movementType}`,
    });

    return {
      success: true,
      resultData: res,
      message: `Inventory movement #${res.id} recorded. Roll ${payload.rollBarcode} updated to ${payload.projectedBalance} meters.`,
    };
  }
}

// ==========================================================
// 4. STITCHING / CMT AGENT
// ==========================================================
export class StitchingAgent extends BaseAgent {
  department = 'STITCHING';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const lineMatch = text.match(/(?:line[\s\-_#]*)([a-z0-9\-]+)/i);
    if (lineMatch && !draft.lineNumber) draft.lineNumber = `LINE-${lineMatch[1].toUpperCase()}`;

    const stitchedMatch = text.match(/(\d+)\s*(?:stitched|pieces?|pcs?|سلائی|پیس)/i);
    if (stitchedMatch && !draft.stitchedQty) draft.stitchedQty = parseInt(stitchedMatch[1], 10);

    const rejectedMatch = text.match(/(\d+)\s*(?:rejected|defect|خراب|نقص)/i);
    if (rejectedMatch && draft.rejectedQty === undefined) draft.rejectedQty = parseInt(rejectedMatch[1], 10);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.stitchedQty) missingFields.push('Stitched Pieces Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'STITCHING_INCOMPLETE',
        department: 'STITCHING',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? `براہ کرم ضروری معلومات درج کریں: ${missingFields.join(', ')}۔ مثال: "PO 452، Line 1 میں 800 پیس سلائی مکمل، 10 ریجیکٹ"`
          : `Please specify ${missingFields.join(', ')}. Example: "PO 452, Line 1, 800 pieces stitched, 10 rejected"`,
      };
    }

    const poRecord = await queryOne<any>(
      `SELECT o.*, s.name as style_name, clr.name as color_name
       FROM orders o
       JOIN styles s ON o.style_id = s.id
       JOIN colors clr ON o.color_id = clr.id
       WHERE o.po_number = ?`,
      [draft.poNumber]
    );

    if (!poRecord) {
      return {
        intentName: 'VALIDATION_ERROR',
        department: 'STITCHING',
        confidence: 0.9,
        extractedParams: draft,
        missingFields: ['Valid PO Number'],
        requiresConfirmation: false,
        followUpPrompt: `PO ${draft.poNumber} not found.`,
      };
    }

    const payload = {
      poNumber: draft.poNumber,
      styleId: poRecord.style_id,
      styleName: poRecord.style_name,
      colorId: poRecord.color_id,
      colorName: poRecord.color_name,
      lineNumber: draft.lineNumber || 'LINE-1',
      receivedCutQty: draft.stitchedQty + (draft.rejectedQty || 0),
      stitchedQty: draft.stitchedQty,
      rejectedQty: draft.rejectedQty || 0,
      reworkQty: draft.reworkQty || 0,
      completedQty: draft.stitchedQty,
      sizeBreakdown: { '28': Math.round(draft.stitchedQty * 0.1), '30': Math.round(draft.stitchedQty * 0.25), '32': Math.round(draft.stitchedQty * 0.35), '34': Math.round(draft.stitchedQty * 0.2), '36': Math.round(draft.stitchedQty * 0.1) },
    };

    const summaryText = isUrdu
      ? `📋 **سلائی (Stitching / CMT) اینٹری برائے تصدیق**:\n• **PO**: ${payload.poNumber} (${payload.styleName})\n• **لائن**: ${payload.lineNumber}\n• **سلائی شدہ پیس**: ${payload.stitchedQty} عدد\n• **ریجیکٹ شدہ**: ${payload.rejectedQty} عدد\n• **واشنگ کے لیے تیار**: ${payload.completedQty} عدد\n\nکیا آپ محفوظ کرنا چاہتے ہیں؟`
      : `📋 **Stitching / CMT Entry for Confirmation**:\n• **PO**: ${payload.poNumber} (${payload.styleName} - ${payload.colorName})\n• **Line**: ${payload.lineNumber}\n• **Stitched Pieces**: ${payload.stitchedQty} pcs\n• **Defects/Rejections**: ${payload.rejectedQty} pcs\n• **Ready for Wash Transfer**: ${payload.completedQty} pcs\n• **Master Wage Accrual**: Rs ${(payload.completedQty * 48).toLocaleString()}\n\nConfirm transaction?`;

    return {
      intentName: 'STITCHING_READY_FOR_CONFIRMATION',
      department: 'STITCHING',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const entryCode = `SE-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60);

    const res = await execute(
      `INSERT INTO stitching_entries (entry_code, po_number, style_id, color_id, line_number, received_cut_qty, stitched_qty, rejected_qty, rework_qty, completed_qty, stitching_master_id, lock_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryCode, payload.poNumber, payload.styleId, payload.colorId, payload.lineNumber, payload.receivedCutQty, payload.stitchedQty, payload.rejectedQty, payload.reworkQty, payload.completedQty, context.userId, lockAt]
    );

    // Accrue Master Piece-Rate Wages (Master Rafiq - Rs 48/pc)
    await recordMasterWageAccrual({
      masterId: 2,
      poNumber: payload.poNumber,
      departmentCode: 'STITCHING',
      approvedQuantity: payload.completedQty,
      ratePerPiece: 48.0,
      userId: context.userId,
    });

    await logAction({
      userId: context.userId,
      userRole: context.userRole,
      action: 'STITCHING_ENTRY_CREATED',
      entityName: 'STITCHING_ENTRY',
      entityId: String(res.lastInsertRowid),
      newData: { entryCode, ...payload },
      source: 'VOICE_AGENT',
    });

    const allocReq = await createAllocationRequest({
      requestType: 'STITCHING_TO_WASHING',
      fromDept: 'STITCHING',
      toDept: 'WASHING',
      poNumber: payload.poNumber,
      styleId: payload.styleId,
      colorId: payload.colorId,
      quantity: payload.completedQty,
      requestedBy: context.userId,
    });

    return {
      success: true,
      resultData: { entryCode, lockAt, allocReq },
      message: `Stitching record #${entryCode} saved for ${payload.completedQty} pcs. Transfer request #${allocReq.request_number} sent to CEO/GM.`,
    };
  }
}

// ==========================================================
// 5. WASHING AGENT
// ==========================================================
export class WashingAgent extends BaseAgent {
  department = 'WASHING';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const batchMatch = text.match(/(?:batch[\s\-_#]*)([a-z0-9\-]+)/i);
    if (batchMatch && !draft.washBatchNo) draft.washBatchNo = `BATCH-${batchMatch[1].toUpperCase()}`;

    const qtyMatch = text.match(/(\d+)\s*(?:processed|pieces?|pcs?|واش|پیس)/i);
    if (qtyMatch && !draft.processedQty) draft.processedQty = parseInt(qtyMatch[1], 10);

    let washType = 'STONE_ENZYME_WASH';
    if (/bleach/i.test(text)) washType = 'BLEACH_WASH';
    if (/raw/i.test(text)) washType = 'RAW_RINSE';
    if (/acid/i.test(text)) washType = 'ACID_WASH';
    draft.washType = washType;

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.processedQty) missingFields.push('Processed Wash Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'WASHING_INCOMPLETE',
        department: 'WASHING',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please provide: ${missingFields.join(', ')}. (e.g. "PO 452, Batch WB-1, Stone Wash 600 pieces")`,
      };
    }

    const payload = {
      poNumber: draft.poNumber,
      washBatchNo: draft.washBatchNo || `WB-${Date.now().toString().substring(8)}`,
      washType: draft.washType,
      receivedQty: draft.processedQty,
      processedQty: draft.processedQty,
      damagedQty: 0,
    };

    return {
      intentName: 'WASHING_READY_FOR_CONFIRMATION',
      department: 'WASHING',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Washing Entry**:\n• **PO**: ${payload.poNumber}\n• **Wash Recipe**: ${payload.washType}\n• **Batch**: ${payload.washBatchNo}\n• **Processed**: ${payload.processedQty} pcs\n• **Master Wage Accrual**: Rs ${(payload.processedQty * 26).toLocaleString()}\n\nConfirm save?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const entryCode = `WE-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60);

    await execute(
      `INSERT INTO washing_entries (entry_code, po_number, wash_batch_no, wash_type, received_qty, processed_qty, damaged_qty, washing_master_id, lock_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryCode, payload.poNumber, payload.washBatchNo, payload.washType, payload.receivedQty, payload.processedQty, payload.damagedQty, context.userId, lockAt]
    );

    // Accrue Master Piece-Rate Wages (Master Zubair - Rs 26/pc)
    await recordMasterWageAccrual({
      masterId: 3,
      poNumber: payload.poNumber,
      departmentCode: 'WASHING',
      approvedQuantity: payload.processedQty,
      ratePerPiece: 26.0,
      userId: context.userId,
    });

    const allocReq = await createAllocationRequest({
      requestType: 'WASHING_TO_FINISHING',
      fromDept: 'WASHING',
      toDept: 'FINISHING',
      poNumber: payload.poNumber,
      quantity: payload.processedQty,
      requestedBy: context.userId,
    });

    return {
      success: true,
      resultData: { entryCode, lockAt, allocReq },
      message: `Washing batch #${entryCode} saved. Handover request created for Finishing.`,
    };
  }
}

// ==========================================================
// 6. FINISHING AGENT
// ==========================================================
export class FinishingAgent extends BaseAgent {
  department = 'FINISHING';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const qtyMatch = text.match(/(\d+)\s*(?:finished|pieces?|pcs?|پیس|فنش)/i);
    if (qtyMatch && !draft.finalPassedQty) draft.finalPassedQty = parseInt(qtyMatch[1], 10);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.finalPassedQty) missingFields.push('Finished Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'FINISHING_INCOMPLETE',
        department: 'FINISHING',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please state ${missingFields.join(', ')} (e.g., "PO 452 finished 500 pcs with trimming and pressing")`,
      };
    }

    const payload = {
      poNumber: draft.poNumber,
      receivedQty: draft.finalPassedQty,
      threadTrimmedQty: draft.finalPassedQty,
      pressedQty: draft.finalPassedQty,
      labeledQty: draft.finalPassedQty,
      finalPassedQty: draft.finalPassedQty,
    };

    return {
      intentName: 'FINISHING_READY_FOR_CONFIRMATION',
      department: 'FINISHING',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Finishing Entry**:\n• **PO**: ${payload.poNumber}\n• **Trimmed & Pressed**: ${payload.finalPassedQty} pcs\n• **Labeled & Ready for QC**: ${payload.finalPassedQty} pcs\n• **Master Wage Accrual**: Rs ${(payload.finalPassedQty * 14).toLocaleString()}\n\nConfirm entry?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const entryCode = `FE-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60);

    await execute(
      `INSERT INTO finishing_entries (entry_code, po_number, received_qty, thread_trimmed_qty, pressed_qty, labeled_qty, final_passed_qty, finishing_master_id, lock_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryCode, payload.poNumber, payload.receivedQty, payload.threadTrimmedQty, payload.pressedQty, payload.labeledQty, payload.finalPassedQty, context.userId, lockAt]
    );

    // Accrue Master Piece-Rate Wages (Master Imran - Rs 14/pc)
    await recordMasterWageAccrual({
      masterId: 4,
      poNumber: payload.poNumber,
      departmentCode: 'FINISHING',
      approvedQuantity: payload.finalPassedQty,
      ratePerPiece: 14.0,
      userId: context.userId,
    });

    return {
      success: true,
      resultData: { entryCode, lockAt },
      message: `Finishing record #${entryCode} saved for ${payload.finalPassedQty} pcs. Ready for QC audit.`,
    };
  }
}

// ==========================================================
// 7. QC AGENT (Packing Hold Capability)
// ==========================================================
export class QcAgent extends BaseAgent {
  department = 'QUALITY';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const passedMatch = text.match(/(\d+)\s*(?:passed|pass|پاس)/i);
    if (passedMatch && !draft.passedQty) draft.passedQty = parseInt(passedMatch[1], 10);

    const failedMatch = text.match(/(\d+)\s*(?:failed|defective|fail|خراب)/i);
    if (failedMatch && draft.failedQty === undefined) draft.failedQty = parseInt(failedMatch[1], 10);

    const isHold = /hold|روک|defect/i.test(text) || (draft.failedQty && draft.failedQty > 20);
    draft.isPackingHold = isHold ? 1 : 0;

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.passedQty) missingFields.push('Passed Quantity');

    if (missingFields.length > 0) {
      return {
        intentName: 'QC_INCOMPLETE',
        department: 'QUALITY',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please provide: ${missingFields.join(', ')} (e.g. "PO 452 final audit: 480 passed, 20 failed due to stitching defects")`,
      };
    }

    const totalInspected = (draft.passedQty || 0) + (draft.failedQty || 0);
    const payload = {
      poNumber: draft.poNumber,
      inspectionStage: 'FINAL_AQL',
      inspectedQty: totalInspected,
      passedQty: draft.passedQty,
      failedQty: draft.failedQty || 0,
      defectType: draft.failedQty > 0 ? 'STITCHING_DEFECT' : null,
      isPackingHold: draft.isPackingHold || 0,
    };

    return {
      intentName: 'QC_READY_FOR_CONFIRMATION',
      department: 'QUALITY',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **QC Inspection Summary**:\n• **PO**: ${payload.poNumber}\n• **Inspected**: ${payload.inspectedQty} pcs\n• **Passed**: ${payload.passedQty} pcs\n• **Failed**: ${payload.failedQty} pcs\n• **Status**: ${payload.isPackingHold ? '🚨 PACKING HOLD TRIGGERED' : '✅ Cleared for Packing'}\n\nConfirm QC log?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const entryCode = `QC-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60);

    await execute(
      `INSERT INTO qc_entries (entry_code, po_number, inspection_stage, inspected_qty, passed_qty, failed_qty, defect_type, is_packing_hold, qc_inspector_id, lock_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryCode, payload.poNumber, payload.inspectionStage, payload.inspectedQty, payload.passedQty, payload.failedQty, payload.defectType, payload.isPackingHold, context.userId, lockAt]
    );

    if (payload.isPackingHold === 1) {
      await broadcastToRole('CEO', `🚨 CRITICAL QC HOLD on PO ${payload.poNumber}`, `High defect rate detected (${payload.failedQty} failed). Packing suspended.`);
      await broadcastToRole('PACKING_MASTER', `⛔ PACKING SUSPENDED on PO ${payload.poNumber}`, `QC inspection placed order on HOLD.`);
    }

    return {
      success: true,
      resultData: { entryCode, lockAt },
      message: `QC report #${entryCode} recorded. ${payload.isPackingHold ? 'PACKING HOLD ACTIVATED.' : 'Passed pieces cleared for packing.'}`,
    };
  }
}

// ==========================================================
// 8. PACKING AGENT (Enforces QC Hold Blockage)
// ==========================================================
export class PackingAgent extends BaseAgent {
  department = 'PACKING';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const cartonMatch = text.match(/(\d+)\s*(?:cartons?|boxes?|ڈبے|کارٹن)/i);
    if (cartonMatch && !draft.totalCartons) draft.totalCartons = parseInt(cartonMatch[1], 10);

    const pcsMatch = text.match(/(\d+)\s*(?:pieces?|pcs?|پیس)/i);
    if (pcsMatch && !draft.totalPieces) draft.totalPieces = parseInt(pcsMatch[1], 10);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.totalCartons) missingFields.push('Total Cartons');
    if (!draft.totalPieces) missingFields.push('Total Pieces');

    if (missingFields.length > 0) {
      return {
        intentName: 'PACKING_INCOMPLETE',
        department: 'PACKING',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please state ${missingFields.join(', ')} (e.g. "PO 452, packed 20 cartons, 400 pieces total")`,
      };
    }

    // Strict QC Hold Check
    const holdCheck = await queryOne<any>('SELECT SUM(is_packing_hold) as holdCount FROM qc_entries WHERE po_number = ?', [draft.poNumber]);
    if (holdCheck && holdCheck.holdCount > 0) {
      return {
        intentName: 'PACKING_BLOCKED_BY_QC',
        department: 'PACKING',
        confidence: 1.0,
        extractedParams: draft,
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: `⛔ CANNOT PACK: PO ${draft.poNumber} is under active QC PACKING HOLD due to defect thresholds. Contact QC Lead / CEO.`,
      };
    }

    const payload = {
      poNumber: draft.poNumber,
      cartonNumber: `CTN-${draft.poNumber}-001-to-${draft.totalCartons}`,
      piecesPerCarton: Math.round(draft.totalPieces / draft.totalCartons),
      totalCartons: draft.totalCartons,
      totalPieces: draft.totalPieces,
    };

    return {
      intentName: 'PACKING_READY_FOR_CONFIRMATION',
      department: 'PACKING',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Packing Summary**:\n• **PO**: ${payload.poNumber}\n• **Cartons**: ${payload.totalCartons}\n• **Pieces / Carton**: ${payload.piecesPerCarton} pcs\n• **Total Packed**: ${payload.totalPieces} pcs\n\nConfirm packing entry?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const entryCode = `PK-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    const lockAt = computeLockExpiration(new Date(), 60);

    await execute(
      `INSERT INTO packing_entries (entry_code, po_number, carton_number, pieces_per_carton, total_cartons, total_pieces, packing_master_id, lock_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entryCode, payload.poNumber, payload.cartonNumber, payload.piecesPerCarton, payload.totalCartons, payload.totalPieces, context.userId, lockAt]
    );

    return {
      success: true,
      resultData: { entryCode, lockAt },
      message: `Packing entry #${entryCode} saved for ${payload.totalPieces} pieces in ${payload.totalCartons} export cartons.`,
    };
  }
}

// ==========================================================
// 9. SHIPMENT AGENT
// ==========================================================
export class ShipmentAgent extends BaseAgent {
  department = 'SHIPMENT';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const draft = { ...(sessionState.draftData || {}) };

    const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poMatch && !draft.poNumber) draft.poNumber = `PO-${poMatch[1]}`;

    const containerMatch = text.match(/(?:container[\s\-_#]*)([a-z0-9\-]+)/i);
    if (containerMatch && !draft.containerNumber) draft.containerNumber = containerMatch[1].toUpperCase();

    const cartonsMatch = text.match(/(\d+)\s*(?:cartons?|boxes?)/i);
    if (cartonsMatch && !draft.totalCartons) draft.totalCartons = parseInt(cartonsMatch[1], 10);

    const pcsMatch = text.match(/(\d+)\s*(?:pieces?|pcs?)/i);
    if (pcsMatch && !draft.totalPieces) draft.totalPieces = parseInt(pcsMatch[1], 10);

    const missingFields: string[] = [];
    if (!draft.poNumber) missingFields.push('PO Number');
    if (!draft.containerNumber) missingFields.push('Container Number');
    if (!draft.totalPieces) missingFields.push('Dispatched Pieces');

    if (missingFields.length > 0) {
      return {
        intentName: 'SHIPMENT_INCOMPLETE',
        department: 'SHIPMENT',
        confidence: 0.85,
        extractedParams: draft,
        missingFields,
        requiresConfirmation: false,
        followUpPrompt: `Please state ${missingFields.join(', ')} (e.g. "PO 452, Container MSCU-9921, 200 cartons, 4000 pcs dispatched")`,
      };
    }

    const payload = {
      shipmentReference: `SHP-${draft.poNumber}-${Date.now().toString().substring(7)}`,
      poNumber: draft.poNumber,
      customerId: 1,
      containerNumber: draft.containerNumber,
      totalCartons: draft.totalCartons || 200,
      totalPieces: draft.totalPieces,
      etd: '2026-09-28',
      eta: '2026-10-25',
    };

    return {
      intentName: 'SHIPMENT_READY_FOR_CONFIRMATION',
      department: 'SHIPMENT',
      confidence: 0.98,
      extractedParams: draft,
      missingFields: [],
      requiresConfirmation: true,
      proposedActionPayload: payload,
      summaryText: `📋 **Export Dispatch Confirmation**:\n• **Ref**: ${payload.shipmentReference}\n• **PO**: ${payload.poNumber}\n• **Container**: ${payload.containerNumber}\n• **Cargo**: ${payload.totalPieces} pcs (${payload.totalCartons} Cartons)\n• **ETD / ETA**: ${payload.etd} ➔ ${payload.eta}\n\nConfirm export dispatch?`,
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    await execute(
      `INSERT INTO shipment_entries (shipment_reference, customer_id, po_number, container_number, total_cartons, total_pieces, etd, eta, status, shipment_officer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCHED', ?)`,
      [payload.shipmentReference, payload.customerId, payload.poNumber, payload.containerNumber, payload.totalCartons, payload.totalPieces, payload.etd, payload.eta, context.userId]
    );

    // Book customer receivable invoice
    const invNo = `REC-${payload.poNumber}-${Date.now().toString().substring(7)}`;
    await execute(
      `INSERT INTO customer_receivables (invoice_number, customer_id, po_number, total_amount, due_date, received_amount, status)
       VALUES (?, ?, ?, ?, DATE('now', '+45 days'), 0, 'PENDING')`,
      [invNo, payload.customerId, payload.poNumber, payload.totalPieces * 16.80]
    );

    await broadcastToRole('CEO', `Export Container Dispatched: ${payload.poNumber}`, `${payload.totalPieces} pieces for PO ${payload.poNumber} loaded in container ${payload.containerNumber}. Invoice #${invNo} booked.`);

    return {
      success: true,
      resultData: { shipmentReference: payload.shipmentReference, invoiceNumber: invNo },
      message: `Shipment #${payload.shipmentReference} registered. Export container ${payload.containerNumber} marked as DISPATCHED.`,
    };
  }
}

// ==========================================================
// 10. FINANCE AGENT
// ==========================================================
export class FinanceAgent extends BaseAgent {
  department = 'FINANCE';

  async processMessage(userInput: string, context: AgentContext, sessionState: any = {}): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';

    if (/pay|disburse|ادا/i.test(text)) {
      const amountMatch = text.match(/(\d+)\s*(?:rs|rupees|usd|\$)/i) || text.match(/(?:rs|rupees|\$)\s*(\d+)/i);
      const masterMatch = text.match(/master\s+([a-z]+)/i);

      if (!amountMatch) {
        return {
          intentName: 'PAYMENT_INCOMPLETE',
          department: 'FINANCE',
          confidence: 0.85,
          extractedParams: {},
          missingFields: ['Payment Amount'],
          requiresConfirmation: false,
          followUpPrompt: 'Please specify payment amount (e.g. "Pay Rs 25000 to Master Akram")',
        };
      }

      const amount = parseInt(amountMatch[1], 10);
      const masterName = masterMatch ? masterMatch[1] : 'Akram';

      const payload = {
        masterId: 1,
        masterName: `Master ${masterName}`,
        amount,
        paymentMethod: 'BANK_TRANSFER',
      };

      return {
        intentName: 'FINANCE_PAYMENT_READY',
        department: 'FINANCE',
        confidence: 0.98,
        extractedParams: payload,
        missingFields: [],
        requiresConfirmation: true,
        proposedActionPayload: payload,
        summaryText: `📋 **Master Wage Payout Voucher**:\n• **Recipient**: ${payload.masterName}\n• **Amount**: Rs ${payload.amount.toLocaleString()}\n• **Method**: Bank Transfer\n\nConfirm wage disbursement?`,
      };
    }

    return {
      intentName: 'FINANCE_QUERY',
      department: 'FINANCE',
      confidence: 0.9,
      extractedParams: {},
      missingFields: [],
      requiresConfirmation: false,
      followUpPrompt: 'Finance Agent Active. You can record payments, check supplier payables (30/60/90 days), or query master rates.',
    };
  }

  async executeConfirmedAction(payload: any, context: AgentContext): Promise<any> {
    const res = await execute(
      `INSERT INTO master_payments (master_id, amount, payment_method, reference_no, paid_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.masterId, payload.amount, payload.paymentMethod, `PAY-${Date.now().toString().substring(7)}`, context.userId]
    );

    return {
      success: true,
      resultData: { paymentId: res.lastInsertRowid },
      message: `Wage payment voucher #${res.lastInsertRowid} recorded for Rs ${payload.amount.toLocaleString()} to ${payload.masterName}.`,
    };
  }
}
