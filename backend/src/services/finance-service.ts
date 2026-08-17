import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';

export interface CreateMasterRateParams {
  masterId: number;
  departmentCode: string;
  styleId?: number;
  operationName: string;
  ratePerPiece: number;
  userId: number;
  userRole: string;
}

export async function createOrUpdateMasterRate(params: CreateMasterRateParams): Promise<any> {
  if (params.ratePerPiece <= 0) {
    throw new Error('Rate per piece must be greater than zero.');
  }

  // Check if rate exists for master + operation + style
  const existing = await queryOne(
    `SELECT id FROM master_rates WHERE master_id = ? AND department_code = ? AND operation_name = ?`,
    [params.masterId, params.departmentCode, params.operationName]
  );

  let rateId: number;

  if (existing) {
    await execute(
      `UPDATE master_rates SET rate_per_piece = ?, style_id = ?, effective_date = DATE('now') WHERE id = ?`,
      [params.ratePerPiece, params.styleId || null, existing.id]
    );
    rateId = existing.id;
  } else {
    const res = await execute(
      `INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece)
       VALUES (?, ?, ?, ?, ?)`,
      [params.masterId, params.departmentCode, params.styleId || null, params.operationName, params.ratePerPiece]
    );
    rateId = res.lastInsertRowid;
  }

  await logAction({
    userId: params.userId,
    userRole: params.userRole,
    action: existing ? 'MASTER_RATE_UPDATED' : 'MASTER_RATE_CREATED',
    entityName: 'MASTER_RATE',
    entityId: String(rateId),
    newData: params,
    reason: `Configured piece-rate for Master #${params.masterId} (${params.operationName})`,
  });

  return queryOne('SELECT * FROM master_rates WHERE id = ?', [rateId]);
}

export async function recordMasterWageAccrual(params: {
  masterId: number;
  poNumber: string;
  departmentCode: string;
  approvedQuantity: number;
  ratePerPiece?: number;
  deductions?: number;
  userId: number;
}): Promise<any> {
  let rate = params.ratePerPiece;
  if (!rate) {
    const rateRow = await queryOne<any>(
      `SELECT rate_per_piece FROM master_rates WHERE master_id = ? AND department_code = ? ORDER BY id DESC LIMIT 1`,
      [params.masterId, params.departmentCode]
    );
    rate = rateRow ? rateRow.rate_per_piece : 5.0; // fallback rate
  }

  const grossAmount = Number((params.approvedQuantity * rate).toFixed(2));
  const deductions = params.deductions || 0;
  const netPayable = Math.max(0, grossAmount - deductions);

  const res = await execute(
    `INSERT INTO master_production_ledger (master_id, po_number, department_code, approved_quantity, rate_per_piece, gross_amount, deductions, net_payable, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [params.masterId, params.poNumber, params.departmentCode, params.approvedQuantity, rate, grossAmount, deductions, netPayable]
  );

  return queryOne('SELECT * FROM master_production_ledger WHERE id = ?', [res.lastInsertRowid]);
}

export async function recordMasterPayment(params: {
  masterId: number;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  paidByUserId: number;
  userRole: string;
}): Promise<any> {
  if (params.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const res = await execute(
    `INSERT INTO master_payments (master_id, amount, payment_method, reference_no, paid_by_user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [params.masterId, params.amount, params.paymentMethod || 'BANK_TRANSFER', params.referenceNo || `PAY-${Date.now().toString().substring(7)}`, params.paidByUserId]
  );

  await logAction({
    userId: params.paidByUserId,
    userRole: params.userRole,
    action: 'MASTER_PAYMENT_DISBURSED',
    entityName: 'MASTER_PAYMENT',
    entityId: String(res.lastInsertRowid),
    newData: params,
    reason: `Disbursed piece-rate payment of Rs ${params.amount} to Master #${params.masterId}`,
  });

  return queryOne('SELECT * FROM master_payments WHERE id = ?', [res.lastInsertRowid]);
}

export async function getAllMasterRates(): Promise<any[]> {
  return query(`
    SELECT mr.*, pm.name as master_name, s.name as style_name, s.code as style_code
    FROM master_rates mr
    JOIN production_masters pm ON mr.master_id = pm.id
    LEFT JOIN styles s ON mr.style_id = s.id
    ORDER BY mr.department_code, pm.name
  `);
}
