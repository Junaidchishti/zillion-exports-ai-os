import { v4 as uuidv4 } from 'uuid';
import { execute, query, queryOne } from '../db/connection.js';

export interface QRCodePayload {
  token: string;
  entityType: 'ALLOCATION' | 'FABRIC_ROLL' | 'CARTON' | 'BUNDLE';
  entityId: number;
  poNumber: string;
  department: string;
  materialOrStyle: string;
  quantity: number;
  approvedBy?: string;
  timestamp: string;
  details?: any;
}

export async function generateQRCode(
  entityType: 'ALLOCATION' | 'FABRIC_ROLL' | 'CARTON' | 'BUNDLE',
  entityId: number,
  department: string,
  poNumber: string,
  payload: Record<string, any>
): Promise<string> {
  const shortId = uuidv4().substring(0, 8).toUpperCase();
  const token = `ZX-${entityType.substring(0, 3)}-${poNumber}-${entityId}-${shortId}`;

  const payloadJson = JSON.stringify({
    ...payload,
    token,
    entityType,
    entityId,
    department,
    poNumber,
    generatedAt: new Date().toISOString(),
  });

  await execute(
    `INSERT INTO qr_codes (qr_data_token, entity_type, entity_id, generated_for_dept, po_number, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [token, entityType, entityId, department, poNumber, payloadJson]
  );

  return token;
}

export async function resolveQRCode(qrToken: string): Promise<QRCodePayload | null> {
  const record = await queryOne<any>(
    `SELECT * FROM qr_codes WHERE qr_data_token = ? AND is_active = 1`,
    [qrToken]
  );

  if (!record) return null;

  // Increment scan count
  await execute(`UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = ?`, [record.id]);

  const parsed = JSON.parse(record.payload_json);
  return {
    token: record.qr_data_token,
    entityType: record.entity_type,
    entityId: record.entity_id,
    poNumber: record.po_number,
    department: record.generated_for_dept,
    materialOrStyle: parsed.material || parsed.style || 'N/A',
    quantity: parsed.quantity || 0,
    approvedBy: parsed.approvedBy,
    timestamp: record.created_at,
    details: parsed,
  };
}

export async function getQRCodesForPO(poNumber: string): Promise<any[]> {
  return query(
    `SELECT * FROM qr_codes WHERE po_number = ? ORDER BY created_at DESC`,
    [poNumber]
  );
}
