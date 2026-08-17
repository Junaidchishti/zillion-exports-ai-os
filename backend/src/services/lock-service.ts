import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';

export interface LockStatus {
  isLocked: boolean;
  lockAt: string;
  minutesRemaining: number;
  canEditDirectly: boolean;
}

export function computeLockExpiration(createdAt: Date = new Date(), graceMinutes: number = 60): string {
  const lockTime = new Date(createdAt.getTime() + graceMinutes * 60 * 1000);
  return lockTime.toISOString().replace('T', ' ').substring(0, 19);
}

export async function checkRecordLock(
  tableName: 'cutting_entries' | 'stitching_entries' | 'washing_entries' | 'finishing_entries' | 'qc_entries' | 'packing_entries',
  recordId: number
): Promise<LockStatus> {
  const row = await queryOne<any>(
    `SELECT lock_at, status, created_at FROM ${tableName} WHERE id = ?`,
    [recordId]
  );

  if (!row) {
    throw new Error(`Record #${recordId} not found in ${tableName}`);
  }

  const now = new Date();
  const lockAtDate = new Date(row.lock_at.replace(' ', 'T') + 'Z');
  const msRemaining = lockAtDate.getTime() - now.getTime();
  const minutesRemaining = Math.max(0, Math.floor(msRemaining / (60 * 1000)));
  const isLocked = msRemaining <= 0 || row.status === 'LOCKED';

  // Automatically update status in DB if expired and not marked locked
  if (isLocked && row.status !== 'LOCKED') {
    await execute(`UPDATE ${tableName} SET status = 'LOCKED' WHERE id = ?`, [recordId]);
  }

  return {
    isLocked,
    lockAt: row.lock_at,
    minutesRemaining,
    canEditDirectly: !isLocked,
  };
}

export async function assertRecordCanBeEdited(
  tableName: 'cutting_entries' | 'stitching_entries' | 'washing_entries' | 'finishing_entries' | 'qc_entries' | 'packing_entries',
  recordId: number,
  userRole: string
): Promise<void> {
  const status = await checkRecordLock(tableName, recordId);
  if (status.isLocked) {
    // Check if user is CEO or GM with override authority, or if an approved EDIT_OVERRIDE exists
    if (userRole !== 'CEO' && userRole !== 'GENERAL_MANAGER') {
      throw new Error(
        `Record #${recordId} is LOCKED (1-hour correction window expired on ${status.lockAt}). Direct modification forbidden. Request CEO/GM edit override authorization.`
      );
    }
  }
}

export async function processExpiredLocks(): Promise<number> {
  const tables = ['cutting_entries', 'stitching_entries', 'washing_entries', 'finishing_entries', 'qc_entries', 'packing_entries'];
  let totalLocked = 0;

  for (const t of tables) {
    const res = await execute(
      `UPDATE ${t} SET status = 'LOCKED' WHERE lock_at <= CURRENT_TIMESTAMP AND status != 'LOCKED'`
    );
    totalLocked += res.changes;
  }

  return totalLocked;
}
