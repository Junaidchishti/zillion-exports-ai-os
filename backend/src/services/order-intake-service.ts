import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';
import { broadcastToRole, sendNotification } from './notification-service.js';

export interface ExtractedOrderBOM {
  customerCode?: string;
  poNumber: string;
  styleCode: string;
  styleName?: string;
  colorName: string;
  totalQuantity: number;
  unitPrice: number;
  deliveryDate: string;
  fabricSpec: string;
  accessoriesSpec: string;
  sizeBreakdown: Record<string, number>;
  rawEmailSubject?: string;
  rawEmailBody?: string;
}

export function parseCustomerOrderEmail(emailSubject: string, emailBody: string): ExtractedOrderBOM {
  const fullText = `${emailSubject}\n${emailBody}`;

  // 1. Extract PO Number (e.g., PO #589, PO-589, Purchase Order 589)
  const poMatch = fullText.match(/(?:po[\s\-_#]*|order[\s\-_#]*|purchase\s+order[\s\-_#]*)(\d+)/i) || fullText.match(/\bPO-(\d+)\b/i);
  const poNumber = poMatch ? `PO-${poMatch[1]}` : `PO-${Date.now().toString().substring(7)}`;

  // 2. Extract Customer (Levi, Zara, Diesel, etc.)
  let customerCode = 'CUST-LEVI';
  if (/zara|inditex/i.test(fullText)) customerCode = 'CUST-ZARA';
  if (/diesel/i.test(fullText)) customerCode = 'CUST-DIESEL';

  // 3. Extract Style (J-801, J-905, J-412)
  let styleCode = 'J-801';
  const styleMatch = fullText.match(/([Jj][\s\-_]?\d{3})/i);
  if (styleMatch) {
    styleCode = styleMatch[1].toUpperCase().replace(/\s+/, '-');
    if (!styleCode.includes('-')) styleCode = styleCode.replace(/([A-Z])(\d+)/, '$1-$2');
  }

  // 4. Extract Color
  let colorName = 'Dark Indigo Blue';
  if (/black|jet\s+black/i.test(fullText)) colorName = 'Deep Jet Black';
  if (/vintage|stonewash|light\s+blue/i.test(fullText)) colorName = 'Light Vintage Stonewash';

  // 5. Extract Total Quantity
  const qtyMatch = fullText.match(/(?:qty|quantity|units?|pieces?|pcs?|total)[\s:=]*(\d[\d,]*)/i) || fullText.match(/(\d[\d,]*)\s*(?:pcs|pieces|units)/i);
  let totalQuantity = qtyMatch ? parseInt(qtyMatch[1].replace(/,/g, ''), 10) : 4000;

  // 6. Extract Unit Price
  const priceMatch = fullText.match(/(?:\$|usd|price)[\s:=]*(\d+(?:\.\d{2})?)/i);
  const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 16.50;

  // 7. Extract Target Delivery Date (e.g. 2026-11-30 or Nov 30, 2026)
  const dateMatch = fullText.match(/(\d{4}-\d{2}-\d{2})/);
  const deliveryDate = dateMatch ? dateMatch[1] : '2026-11-30';

  // 8. Extract Size Breakdown Matrix
  const sizeBreakdown: Record<string, number> = {};
  
  // Isolate size breakdown section if available to prevent date collision
  const sizeSectionMatch = fullText.match(/(?:size\s+breakdown|breakdown|sizes)[\s:=]*([\s\S]+?)(?:delivery|specifications|regards|$)/i);
  const textToScanForSizes = sizeSectionMatch ? sizeSectionMatch[1] : fullText;

  const sizeMatches = [...textToScanForSizes.matchAll(/(?:size|سائز)?\s*\b(2[6-9]|3[0-9]|4[0-4])\b\s*[:=-]\s*(\d[\d,]*)/gi)];
  if (sizeMatches.length > 0) {
    for (const m of sizeMatches) {
      sizeBreakdown[m[1]] = parseInt(m[2].replace(/,/g, ''), 10);
    }
  } else {
    // Proportional breakdown if not explicit
    sizeBreakdown['28'] = Math.round(totalQuantity * 0.1);
    sizeBreakdown['30'] = Math.round(totalQuantity * 0.25);
    sizeBreakdown['32'] = Math.round(totalQuantity * 0.35);
    sizeBreakdown['34'] = Math.round(totalQuantity * 0.2);
    sizeBreakdown['36'] = Math.round(totalQuantity * 0.1);
  }

  // Harmonize quantity to breakdown sum
  const sum = Object.values(sizeBreakdown).reduce((a, b) => a + b, 0);
  if (sum > 0) totalQuantity = sum;

  return {
    customerCode,
    poNumber,
    styleCode,
    colorName,
    totalQuantity,
    unitPrice,
    deliveryDate,
    fabricSpec: '12oz Indigo Stretch Denim, Ring Spun',
    accessoriesSpec: 'YKK Brass Zippers, Zillion Gunmetal Rivets & Shank, Satin Brand Label',
    sizeBreakdown,
    rawEmailSubject: emailSubject,
    rawEmailBody: emailBody,
  };
}

export async function submitOrderForMerchandisingReview(extracted: ExtractedOrderBOM, userId: number): Promise<any> {
  const custRow = await queryOne('SELECT id FROM customers WHERE code = ?', [extracted.customerCode || 'CUST-LEVI']);
  const styleRow = await queryOne('SELECT id FROM styles WHERE code = ?', [extracted.styleCode]);
  const colorRow = await queryOne('SELECT id FROM colors WHERE name LIKE ?', [`%${extracted.colorName}%`]) || await queryOne('SELECT id FROM colors LIMIT 1');

  const customerId = custRow ? custRow.id : 1;
  const styleId = styleRow ? styleRow.id : 1;
  const colorId = colorRow ? colorRow.id : 1;

  // Check if PO exists
  const existing = await queryOne('SELECT id FROM orders WHERE po_number = ?', [extracted.poNumber]);
  if (existing) {
    throw new Error(`Order with PO Number ${extracted.poNumber} already exists in database.`);
  }

  const res = await execute(
    `INSERT INTO orders (po_number, customer_id, style_id, color_id, order_qty, unit_price, target_delivery_date, fabric_requirement_spec, accessories_spec, customer_notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
    [
      extracted.poNumber,
      customerId,
      styleId,
      colorId,
      extracted.totalQuantity,
      extracted.unitPrice,
      extracted.deliveryDate,
      extracted.fabricSpec,
      extracted.accessoriesSpec,
      `Email Intake: ${extracted.rawEmailSubject || 'Manual Import'}`,
    ]
  );

  const orderId = res.lastInsertRowid;

  // Insert Size Breakdowns
  for (const [sizeLabel, qty] of Object.entries(extracted.sizeBreakdown)) {
    const sizeRow = await queryOne<any>('SELECT id FROM sizes WHERE size_label = ?', [sizeLabel]);
    if (sizeRow && Number(qty) > 0) {
      await execute('INSERT INTO order_size_breakdowns (order_id, size_id, quantity) VALUES (?, ?, ?)', [orderId, sizeRow.id, Number(qty)]);
    }
  }

  // Notify Merchandising Officer for review
  await broadcastToRole('MERCHANDISER', `New Customer Order Intake: ${extracted.poNumber}`, `Order ${extracted.poNumber} for ${extracted.totalQuantity} pcs received from email. Ready for BOM and spec review.`);

  await logAction({
    userId,
    action: 'ORDER_INTAKE_EXTRACTED',
    entityName: 'ORDER',
    entityId: String(orderId),
    newData: extracted,
    reason: 'Customer Order email parsed into structured BOM draft',
  });

  return queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
}

export async function approveOrderByMerchandiser(orderId: number, merchandiserUserId: number): Promise<any> {
  await execute(
    `UPDATE orders
     SET status = 'PENDING_APPROVAL', merch_approved_by = ?, merch_approved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [merchandiserUserId, orderId]
  );

  const ord = await queryOne<any>('SELECT * FROM orders WHERE id = ?', [orderId]);

  // Request CEO Final Approval
  await broadcastToRole('CEO', `Order ${ord.po_number} Merchandising Approved`, `Order ${ord.po_number} (${ord.order_qty} pcs) has been verified by Merchandising Officer. Requires CEO final approval to enter production.`);

  await logAction({
    userId: merchandiserUserId,
    userRole: 'MERCHANDISER',
    action: 'ORDER_MERCHANDISER_APPROVED',
    entityName: 'ORDER',
    entityId: String(orderId),
    newData: { status: 'PENDING_APPROVAL', merchApprovedBy: merchandiserUserId },
    reason: 'BOM and specifications verified by Merchandising Officer',
  });

  return queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
}

export async function approveOrderByCeo(orderId: number, ceoUserId: number): Promise<any> {
  const ord = await queryOne<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!ord) throw new Error(`Order #${orderId} not found.`);

  if (!ord.merch_approved_by) {
    throw new Error(`Order #${orderId} requires prior Merchandising Officer review and sign-off before CEO approval.`);
  }

  await execute(
    `UPDATE orders
     SET status = 'APPROVED', ceo_approved_by = ?, ceo_approved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [ceoUserId, orderId]
  );

  // Notify Store and Cutting to begin lay planning
  await broadcastToRole('CUTTING_MASTER', `Order ${ord.po_number} Approved for Production`, `CEO has approved PO ${ord.po_number} for ${ord.order_qty} pieces. Cutting department may issue fabric rolls.`);
  await broadcastToRole('STORE_MASTER', `Order ${ord.po_number} Approved`, `PO ${ord.po_number} is now live in production. Prepare fabric and accessories.`);

  await logAction({
    userId: ceoUserId,
    userRole: 'CEO',
    action: 'ORDER_CEO_APPROVED',
    entityName: 'ORDER',
    entityId: String(orderId),
    newData: { status: 'APPROVED', ceoApprovedBy: ceoUserId },
    reason: 'CEO final approval granted for factory production release',
  });

  return queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
}
