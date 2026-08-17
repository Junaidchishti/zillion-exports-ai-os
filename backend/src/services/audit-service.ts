import { execute, query } from '../db/connection.js';

export interface AuditLogEntry {
  userId?: number;
  userRole?: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  reason?: string;
  ipAddress?: string;
  source?: 'WEB_UI' | 'VOICE_AGENT' | 'API' | 'SYSTEM';
}

export async function logAction(entry: AuditLogEntry): Promise<void> {
  const oldJson = entry.oldData ? JSON.stringify(entry.oldData) : null;
  const newJson = entry.newData ? JSON.stringify(entry.newData) : null;

  await execute(
    `INSERT INTO audit_logs (user_id, user_role, action, entity_name, entity_id, old_data_json, new_data_json, reason, ip_address, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId || null,
      entry.userRole || null,
      entry.action,
      entry.entityName,
      entry.entityId ? String(entry.entityId) : null,
      oldJson,
      newJson,
      entry.reason || null,
      entry.ipAddress || '127.0.0.1',
      entry.source || 'WEB_UI',
    ]
  );
}

export async function getRecentAuditLogs(limit: number = 50, entityName?: string, poNumber?: string): Promise<any[]> {
  let sql = `
    SELECT a.*, u.full_name as user_full_name, u.username
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
  `;
  const params: any[] = [];
  const whereClauses: string[] = [];

  if (entityName) {
    whereClauses.push('a.entity_name = ?');
    params.push(entityName);
  }
  if (poNumber) {
    whereClauses.push('(a.entity_id = ? OR a.new_data_json LIKE ?)');
    params.push(poNumber, `%${poNumber}%`);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(limit);

  return query(sql, params);
}
