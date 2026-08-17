import { BaseAgent, AgentContext, AgentIntent } from './base-agent.js';
import { query, queryOne, execute } from '../db/connection.js';
import { getPOProgressOverview, getCuttingAnalytics, getFinancialSummary, getDepartmentBottlenecks } from '../services/analytics-service.js';
import { logAction } from '../services/audit-service.js';
import { broadcastToRole, sendNotification } from '../services/notification-service.js';
import { reviewAllocationRequest } from '../services/approval-service.js';

export class CeoAgent extends BaseAgent {
  department = 'EXECUTIVE';

  async processMessage(
    userInput: string,
    context: AgentContext,
    sessionState: any = {}
  ): Promise<AgentIntent> {
    const text = userInput.trim();
    const isUrdu = context.language === 'ur';

    // Verify role permissions
    if (context.userRole !== 'CEO' && context.userRole !== 'GENERAL_MANAGER') {
      return {
        intentName: 'UNAUTHORIZED',
        department: 'EXECUTIVE',
        confidence: 1.0,
        extractedParams: {},
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: isUrdu
          ? 'غیر مجاز رسائی: صرف CEO اور جنرل منیجر ہی ایگزیکٹو انٹیلی جنس تک رسائی حاصل کر سکتے ہیں۔'
          : 'Unauthorized Access: Only CEO and General Manager have access to Executive Intelligence & Command Layer.',
      };
    }

    const lower = text.toLowerCase();

    // =========================================================================
    // 1. EXECUTIVE COMMANDS (Prioritize PO, Packing Hold, Approve Request)
    // =========================================================================

    // Command: "Tell Cutting/Stitching to prioritize PO 452"
    if (lower.includes('prioritize') || lower.includes('ترجیح') || lower.includes('urgent')) {
      const poMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
      const targetPo = poMatch ? `PO-${poMatch[1]}` : null;
      let targetDept = 'ALL';
      if (lower.includes('cutting') || lower.includes('کٹنگ')) targetDept = 'CUTTING';
      if (lower.includes('stitching') || lower.includes('سلائی')) targetDept = 'STITCHING';
      if (lower.includes('washing') || lower.includes('واشنگ')) targetDept = 'WASHING';

      if (!targetPo) {
        return {
          intentName: 'COMMAND_NEEDS_PO',
          department: 'EXECUTIVE',
          confidence: 0.9,
          extractedParams: { targetDept },
          missingFields: ['PO Number'],
          requiresConfirmation: false,
          followUpPrompt: isUrdu
            ? 'براہ کرم ترجیح دینے کے لیے مطلوبہ PO نمبر بتائیں (مثلاً PO 452)۔'
            : 'Please specify which PO Number you want to prioritize (e.g. PO 452).',
        };
      }

      const promptSummary = isUrdu
        ? `⚠️ **ایگزیکٹو حکم برائے تصدیق**:\nکیا آپ **${targetDept}** ڈیپارٹمنٹ کو **${targetPo}** پر فوری ترجیحی کام کرنے کا سرکاری نوٹس بھیجنا چاہتے ہیں؟`
        : `⚠️ **Executive Priority Directive**:\nDo you confirm broadcasting an urgent priority mandate to **${targetDept} Department** for **${targetPo}**?`;

      return {
        intentName: 'EXECUTE_PRIORITY_COMMAND',
        department: 'EXECUTIVE',
        confidence: 0.95,
        extractedParams: { targetPo, targetDept },
        missingFields: [],
        requiresConfirmation: true,
        proposedActionPayload: {
          commandType: 'PRIORITIZE_PO',
          poNumber: targetPo,
          targetDept,
        },
        summaryText: promptSummary,
      };
    }

    // Command: "Approve request REQ-..."
    if (lower.includes('approve') || lower.includes('منظور')) {
      const reqMatch = text.match(/(?:req[\s\-_#]*[a-z0-9\-]+)/i);
      if (reqMatch) {
        const reqStr = reqMatch[0].toUpperCase();
        const reqRow = await queryOne<any>(
          'SELECT * FROM allocation_requests WHERE request_number LIKE ? AND status = "PENDING"',
          [`%${reqStr}%`]
        );
        if (reqRow) {
          return {
            intentName: 'EXECUTE_APPROVAL_COMMAND',
            department: 'EXECUTIVE',
            confidence: 0.98,
            extractedParams: { requestId: reqRow.id },
            missingFields: [],
            requiresConfirmation: true,
            proposedActionPayload: {
              commandType: 'APPROVE_REQUEST',
              requestId: reqRow.id,
              requestNumber: reqRow.request_number,
            },
            summaryText: isUrdu
              ? `کیا آپ درخواست **#${reqRow.request_number}** (${reqRow.quantity} پیس برائے ${reqRow.to_dept}) کی منظوری دینا چاہتے ہیں؟`
              : `Confirm immediate approval for Allocation Request **#${reqRow.request_number}** (${reqRow.quantity} pcs to ${reqRow.to_dept})?`,
          };
        }
      }
    }

    // =========================================================================
    // 2. LIVE EXECUTIVE INTELLIGENCE QUERIES (Live DB Data)
    // =========================================================================

    // Query: PO Status (e.g. "What is the status of PO 452?")
    const poCheckMatch = text.match(/(?:po[\s\-_#]*)(\d+)/i) || text.match(/\b(\d{3,4})\b/);
    if (poCheckMatch && (lower.includes('status') || lower.includes('صورتحال') || lower.includes('progress') || lower.includes('کتنا'))) {
      const poNum = `PO-${poCheckMatch[1]}`;
      const [poData] = await getPOProgressOverview(poNum);

      if (!poData) {
        return {
          intentName: 'PO_NOT_FOUND',
          department: 'EXECUTIVE',
          confidence: 0.9,
          extractedParams: { poNum },
          missingFields: [],
          requiresConfirmation: false,
          followUpPrompt: isUrdu
            ? `آرڈر ${poNum} سسٹم میں نہیں ملا۔`
            : `Order ${poNum} not found in current factory records.`,
        };
      }

      const responseText = isUrdu
        ? `📊 **لائیو سٹیٹس: ${poData.po_number}** (${poData.customer_name})\n` +
          `• اسٹائل: ${poData.style_name} | کل آرڈر: ${poData.order_qty} پیس\n` +
          `• ڈیلیوری کی تاریخ: ${poData.target_delivery_date} (${poData.isDelayed ? '⚠️ تاخیر کا شکار' : 'بروقت'})\n` +
          `• کٹنگ: ${poData.cut_qty} پیس (${poData.cutProgress}% مکمل)\n` +
          `• سلائی (Stitching): ${poData.stitched_qty} پیس\n` +
          `• واشنگ: ${poData.washed_qty} پیس | فنشنگ: ${poData.finished_qty} پیس\n` +
          `• QC پاس: ${poData.qc_passed_qty} پیس (ناکام: ${poData.qc_failed_qty})\n` +
          `• پیک شدہ: ${poData.packed_qty} پیس | جہاز رانی (Shipped): ${poData.shipped_qty} پیس`
        : `📊 **Live PO Intelligence: ${poData.po_number}** (${poData.customer_name})\n` +
          `• Style: ${poData.style_name} | Total Order: **${poData.order_qty.toLocaleString()} pcs**\n` +
          `• Target Delivery: **${poData.target_delivery_date}** (${poData.isDelayed ? '⚠️ DELAY RISK' : '✅ On Schedule'})\n` +
          `• **Cutting**: ${poData.cut_qty.toLocaleString()} pcs (${poData.cutProgress}% Cut)\n` +
          `• **Stitching**: ${poData.stitched_qty.toLocaleString()} pcs\n` +
          `• **Washing**: ${poData.washed_qty.toLocaleString()} pcs | **Finishing**: ${poData.finished_qty.toLocaleString()} pcs\n` +
          `• **QC Audited**: ${poData.qc_passed_qty.toLocaleString()} passed (Failed: ${poData.qc_failed_qty})\n` +
          `• **Packing & Shipment**: ${poData.packed_qty.toLocaleString()} packed (${poData.finalProgress}%) | ${poData.shipped_qty.toLocaleString()} shipped.`;

      return {
        intentName: 'PO_STATUS_RESPONSE',
        department: 'EXECUTIVE',
        confidence: 0.99,
        extractedParams: { poData },
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: responseText,
      };
    }

    // Query: Fabric availability & waste
    if (lower.includes('fabric') || lower.includes('waste') || lower.includes('کپڑا') || lower.includes('ضیاع') || lower.includes('رول')) {
      const cutAnalytics = await getCuttingAnalytics();
      const s = cutAnalytics.summary;

      const fabricText = isUrdu
        ? `🧵 **فیبرک اور کٹنگ اینالیٹکس (Live)**:\n` +
          `• کل کٹ پیس: **${s.totalPiecesCut.toLocaleString()} عدد**\n` +
          `• کل جاری شدہ کپڑا: **${s.totalFabricIssued.toLocaleString()} میٹر**\n` +
          `• کپڑے کا اوسط ضیاع (Waste): **${s.avgWastePercentage}%** (کل ضیاع: ${s.totalWasteMeters}m)\n` +
          `• دستیاب فیبرک رولز: **${cutAnalytics.availableRolls.length} رولز** گودام میں موجود ہیں۔`
        : `🧵 **Fabric & Waste Intelligence (Live Data)**:\n` +
          `• Total Garments Cut: **${s.totalPiecesCut.toLocaleString()} pcs**\n` +
          `• Total Fabric Utilized: **${s.totalFabricConsumed.toLocaleString()} m** (Issued: ${s.totalFabricIssued.toLocaleString()} m)\n` +
          `• Average Factory Waste Rate: **${s.avgWastePercentage}%** (Total Scrap: ${s.totalWasteMeters.toLocaleString()} m)\n` +
          `• Active Fabric Rolls in Stock: **${cutAnalytics.availableRolls.length} rolls** ready for lay planning.`;

      return {
        intentName: 'FABRIC_WASTE_RESPONSE',
        department: 'EXECUTIVE',
        confidence: 0.98,
        extractedParams: { cutAnalytics },
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: fabricText,
      };
    }

    // Query: Financials (Payables, Receivables, Master payouts)
    if (lower.includes('pay') || lower.includes('owe') || lower.includes('finance') || lower.includes('رقم') || lower.includes('ادائیگی') || lower.includes('واجبات')) {
      const fin = await getFinancialSummary();
      const p = fin.payables;
      const r = fin.receivables;

      const finText = isUrdu
        ? `💰 **فیکٹری مالیاتی پوزیشن (Live Financials)**:\n` +
          `• **سپلائر واجبات (Payables)**: $${p.outstandingPayables.toLocaleString()} (جس میں سے $${p.overduePayables.toLocaleString()} واجب الادا ہیں)\n` +
          `• **کسٹمر وصولیاں (Receivables)**: $${r.outstandingReceivables.toLocaleString()} (جس میں سے $${r.overdueReceivables.toLocaleString()} موصول ہونا باقی ہیں)\n` +
          `• **پروڈکشن ماسٹرز کے واجبات**: ${fin.masterPayroll.map((m: any) => `${m.masterName} (${m.department}): Rs ${m.balanceOutstanding.toLocaleString()}`).join(', ')}`
        : `💰 **Executive Financial Intelligence (Live Snapshot)**:\n` +
          `• **Supplier Payables**: **$${p.outstandingPayables.toLocaleString()}** outstanding (Overdue: **$${p.overduePayables.toLocaleString()}**)\n` +
          `• **Customer Receivables**: **$${r.outstandingReceivables.toLocaleString()}** uncollected (Overdue: **$${r.overdueReceivables.toLocaleString()}**)\n` +
          `• **Production Master Piece-Rate Balances**:\n` +
          fin.masterPayroll.map((m: any) => `  - **${m.masterName}** (${m.department}): Rs ${m.balanceOutstanding.toLocaleString()} payable`).join('\n');

      return {
        intentName: 'FINANCE_SUMMARY_RESPONSE',
        department: 'EXECUTIVE',
        confidence: 0.98,
        extractedParams: { fin },
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: finText,
      };
    }

    // Query: Delays and Bottlenecks
    if (lower.includes('delay') || lower.includes('behind') || lower.includes('bottleneck') || lower.includes('مسئلہ') || lower.includes('تاخیر')) {
      const bottlenecks = await getDepartmentBottlenecks();
      const delayedPOs = (await getPOProgressOverview()).filter((p) => p.isDelayed);

      const bottleneckText = isUrdu
        ? `🚨 **فیکٹری میں تاخیر اور رکاوٹوں کی لائیو رپورٹ**:\n` +
          (bottlenecks.length === 0
            ? 'تمام ڈیپارٹمنٹس بروقت کام کر رہے ہیں، کوئی بڑی رکاوٹ نہیں۔'
            : bottlenecks.map((b) => `• [${b.department}] ${b.message} (شدت: ${b.severity})`).join('\n')) +
          `\n• تاخیر کا شکار آرڈرز: ${delayedPOs.length > 0 ? delayedPOs.map((p) => p.po_number).join(', ') : 'کوئی نہیں'}`
        : `🚨 **Live Bottlenecks & Production Risk Alert**:\n` +
          (bottlenecks.length === 0
            ? '✅ All lines operating smoothly. Zero critical department blockages detected.'
            : bottlenecks.map((b) => `• **[${b.department}]** ${b.message} [Severity: **${b.severity}**]`).join('\n')) +
          (delayedPOs.length > 0 ? `\n• ⚠️ Approaching/Overdue POs: ${delayedPOs.map((p) => `${p.po_number} (Due: ${p.target_delivery_date})`).join(', ')}` : '');

      return {
        intentName: 'BOTTLENECK_RESPONSE',
        department: 'EXECUTIVE',
        confidence: 0.98,
        extractedParams: { bottlenecks },
        missingFields: [],
        requiresConfirmation: false,
        followUpPrompt: bottleneckText,
      };
    }

    // Default: Overall Factory Overview
    const allPOs = await getPOProgressOverview();
    const activeCount = allPOs.length;
    const totalOrdered = allPOs.reduce((a, b) => a + b.order_qty, 0);
    const totalCut = allPOs.reduce((a, b) => a + b.cut_qty, 0);
    const totalPacked = allPOs.reduce((a, b) => a + b.packed_qty, 0);

    const overviewText = isUrdu
      ? `🏭 **زیلین ایکسپورٹس - فیکٹری اوور ویو (Live)**:\n` +
        `• فعال پروڈکشن آرڈرز: **${activeCount} آرڈرز** (کل تعداد: ${totalOrdered.toLocaleString()} پیس)\n` +
        `• کل کٹنگ ہو چکی: **${totalCut.toLocaleString()} پیس**\n` +
        `• کل پیک شدہ مال: **${totalPacked.toLocaleString()} پیس**\n` +
        `• آپ کسی بھی مخصوص PO، فیبرک، سپلائر کی ادائیگی یا ڈیپارٹمنٹ کی تفصیل معلوم کر سکتے ہیں۔`
      : `🏭 **Zillion Exports — Executive Factory Overview (Live Data)**:\n` +
        `• **Active Orders in Pipeline**: **${activeCount} POs** (Total volume: **${totalOrdered.toLocaleString()} pcs**)\n` +
        `• **Cutting Progress**: **${totalCut.toLocaleString()} pcs cut**\n` +
        `• **Finished & Packed**: **${totalPacked.toLocaleString()} pcs packaged**\n` +
        `• **Executive Commands Available**: "Prioritize PO [number]", "Show fabric waste", "Show payables due", "Status of PO [number]".`;

    return {
      intentName: 'FACTORY_OVERVIEW_RESPONSE',
      department: 'EXECUTIVE',
      confidence: 0.95,
      extractedParams: {},
      missingFields: [],
      requiresConfirmation: false,
      followUpPrompt: overviewText,
    };
  }

  async executeConfirmedAction(
    payload: any,
    context: AgentContext
  ): Promise<{ success: boolean; resultData: any; message: string }> {
    const isUrdu = context.language === 'ur';

    if (payload.commandType === 'PRIORITIZE_PO') {
      await broadcastToRole(
        payload.targetDept === 'ALL' ? 'ALL' : `${payload.targetDept}_MASTER`,
        `🚨 EXECUTIVE MANDATE: Prioritize ${payload.poNumber}`,
        `Direct order from ${context.userRole}: Halt secondary lines and allocate primary capacity to ${payload.poNumber} immediately.`
      );

      await logAction({
        userId: context.userId,
        userRole: context.userRole,
        action: 'EXECUTIVE_PRIORITY_DIRECTIVE',
        entityName: 'ORDER',
        entityId: payload.poNumber,
        newData: payload,
        reason: `Executive priority override issued by ${context.userRole}`,
        source: 'VOICE_AGENT',
      });

      return {
        success: true,
        resultData: payload,
        message: isUrdu
          ? `✅ ایگزیکٹو ترجیحی نوٹس جاری کر دیا گیا ہے اور متعلقہ ڈیپارٹمنٹ کو مطلع کر دیا گیا ہے۔`
          : `✅ Executive Priority Directive successfully dispatched to ${payload.targetDept} for ${payload.poNumber}.`,
      };
    }

    if (payload.commandType === 'APPROVE_REQUEST') {
      const reviewRes = await reviewAllocationRequest(
        payload.requestId,
        'APPROVED',
        context.userId,
        context.userRole,
        'Executive instant approval via Voice/AI command'
      );

      return {
        success: true,
        resultData: reviewRes,
        message: isUrdu
          ? `✅ درخواست #${payload.requestNumber} منظور کر دی گئی ہے اور QR کوڈ جنریٹ ہو چکا ہے۔`
          : `✅ Allocation Request #${payload.requestNumber} approved. QR Code: ${reviewRes.qrToken}`,
      };
    }

    return {
      success: false,
      resultData: null,
      message: 'Unknown executive command',
    };
  }
}
