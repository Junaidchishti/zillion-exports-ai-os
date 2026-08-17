import { execute, query, queryOne } from '../db/connection.js';
import { logAction } from './audit-service.js';

export interface InventoryMovementParams {
  transactionType: 'IN' | 'OUT' | 'ISSUE' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT';
  itemCategory: 'FABRIC_ROLL' | 'ACCESSORY';
  rollId?: number;
  accessoryId?: number;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  referencePo?: string;
  notes?: string;
  userId: number;
  userRole: string;
}

export async function recordInventoryMovement(params: InventoryMovementParams): Promise<any> {
  if (params.quantity <= 0) {
    throw new Error('Transaction quantity must be greater than zero.');
  }

  // 1. Process Fabric Roll Movement
  if (params.itemCategory === 'FABRIC_ROLL') {
    if (!params.rollId) {
      throw new Error('Roll ID is required for fabric roll movements.');
    }

    const roll = await queryOne<any>('SELECT * FROM fabric_rolls WHERE id = ?', [params.rollId]);
    if (!roll) {
      throw new Error(`Fabric roll #${params.rollId} not found.`);
    }

    if (params.transactionType === 'OUT' || params.transactionType === 'ISSUE') {
      if (roll.remaining_length_meters < params.quantity) {
        throw new Error(
          `Negative stock prohibited: Roll ${roll.roll_barcode} only has ${roll.remaining_length_meters}m remaining (Attempted: ${params.quantity}m).`
        );
      }

      const newRemaining = roll.remaining_length_meters - params.quantity;
      const newStatus = newRemaining <= 5 ? 'CONSUMED' : 'AVAILABLE';

      await execute(
        `UPDATE fabric_rolls
         SET remaining_length_meters = ?, status = ?
         WHERE id = ?`,
        [newRemaining, newStatus, params.rollId]
      );
    } else if (params.transactionType === 'RETURN' || params.transactionType === 'IN') {
      await execute(
        `UPDATE fabric_rolls
         SET remaining_length_meters = remaining_length_meters + ?, status = 'AVAILABLE'
         WHERE id = ?`,
        [params.quantity, params.rollId]
      );
    } else if (params.transactionType === 'TRANSFER' && params.toLocation) {
      await execute(
        `UPDATE fabric_rolls SET warehouse_location = ? WHERE id = ?`,
        [params.toLocation, params.rollId]
      );
    }

    const res = await execute(
      `INSERT INTO inventory_transactions (transaction_type, item_category, roll_id, quantity, from_location, to_location, reference_po, notes, created_by)
       VALUES (?, 'FABRIC_ROLL', ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.transactionType,
        params.rollId,
        params.quantity,
        params.fromLocation || roll.warehouse_location,
        params.toLocation || null,
        params.referencePo || null,
        params.notes || null,
        params.userId,
      ]
    );

    await logAction({
      userId: params.userId,
      userRole: params.userRole,
      action: `INVENTORY_${params.transactionType}`,
      entityName: 'FABRIC_ROLL',
      entityId: String(params.rollId),
      newData: { ...params, rollBarcode: roll.roll_barcode },
      reason: params.notes || `Store ${params.transactionType} transaction`,
    });

    return queryOne('SELECT * FROM inventory_transactions WHERE id = ?', [res.lastInsertRowid]);
  }

  // 2. Process Accessory Movement
  if (params.itemCategory === 'ACCESSORY') {
    if (!params.accessoryId) {
      throw new Error('Accessory ID is required for accessory movements.');
    }

    const acc = await queryOne<any>('SELECT * FROM accessories WHERE id = ?', [params.accessoryId]);
    if (!acc) {
      throw new Error(`Accessory #${params.accessoryId} not found.`);
    }

    if (params.transactionType === 'OUT' || params.transactionType === 'ISSUE') {
      if (acc.current_stock < params.quantity) {
        throw new Error(
          `Negative stock prohibited: Accessory ${acc.name} (${acc.item_code}) only has ${acc.current_stock} in stock (Attempted: ${params.quantity}).`
        );
      }

      await execute(
        `UPDATE accessories SET current_stock = current_stock - ? WHERE id = ?`,
        [params.quantity, params.accessoryId]
      );
    } else if (params.transactionType === 'IN' || params.transactionType === 'RETURN') {
      await execute(
        `UPDATE accessories SET current_stock = current_stock + ? WHERE id = ?`,
        [params.quantity, params.accessoryId]
      );
    }

    const res = await execute(
      `INSERT INTO inventory_transactions (transaction_type, item_category, item_id, quantity, reference_po, notes, created_by)
       VALUES (?, 'ACCESSORY', ?, ?, ?, ?, ?)`,
      [
        params.transactionType,
        params.accessoryId,
        params.quantity,
        params.referencePo || null,
        params.notes || null,
        params.userId,
      ]
    );

    await logAction({
      userId: params.userId,
      userRole: params.userRole,
      action: `INVENTORY_${params.transactionType}`,
      entityName: 'ACCESSORY',
      entityId: String(params.accessoryId),
      newData: { ...params, accessoryCode: acc.item_code },
      reason: params.notes || `Accessory ${params.transactionType} transaction`,
    });

    return queryOne('SELECT * FROM inventory_transactions WHERE id = ?', [res.lastInsertRowid]);
  }

  throw new Error('Invalid item category. Must be FABRIC_ROLL or ACCESSORY.');
}

export async function checkInNewFabricRoll(params: {
  rollBarcode: string;
  supplierId: number;
  fabricType: string;
  shadeColor: string;
  lotBatchNumber: string;
  originalLengthMeters: number;
  warehouseLocation?: string;
  userId: number;
  userRole: string;
}): Promise<any> {
  const existing = await queryOne('SELECT id FROM fabric_rolls WHERE roll_barcode = ?', [params.rollBarcode]);
  if (existing) {
    throw new Error(`Fabric roll barcode ${params.rollBarcode} already exists.`);
  }

  const res = await execute(
    `INSERT INTO fabric_rolls (roll_barcode, supplier_id, fabric_type, shade_color, lot_batch_number, original_length_meters, remaining_length_meters, warehouse_location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
    [
      params.rollBarcode,
      params.supplierId,
      params.fabricType,
      params.shadeColor,
      params.lotBatchNumber,
      params.originalLengthMeters,
      params.originalLengthMeters,
      params.warehouseLocation || 'RACK-A1',
    ]
  );

  const rollId = res.lastInsertRowid;

  // Record initial receipt transaction in ledger
  await execute(
    `INSERT INTO inventory_transactions (transaction_type, item_category, roll_id, quantity, to_location, notes, created_by)
     VALUES ('IN', 'FABRIC_ROLL', ?, ?, ?, 'Initial roll check-in from supplier', ?)`,
    [rollId, params.originalLengthMeters, params.warehouseLocation || 'RACK-A1', params.userId]
  );

  await logAction({
    userId: params.userId,
    userRole: params.userRole,
    action: 'INVENTORY_IN',
    entityName: 'FABRIC_ROLL',
    entityId: String(rollId),
    newData: params,
    reason: 'Initial roll check-in from supplier',
  });

  return queryOne('SELECT * FROM fabric_rolls WHERE id = ?', [rollId]);
}

export async function getAllAccessories(): Promise<any[]> {
  return query('SELECT * FROM accessories ORDER BY item_type, name');
}

export async function getRecentInventoryTransactions(limit: number = 50): Promise<any[]> {
  return query(`
    SELECT it.*, fr.roll_barcode, fr.fabric_type, a.name as accessory_name, a.item_code, u.full_name as created_by_name
    FROM inventory_transactions it
    LEFT JOIN fabric_rolls fr ON it.roll_id = fr.id
    LEFT JOIN accessories a ON it.item_id = a.id
    LEFT JOIN users u ON it.created_by = u.id
    ORDER BY it.created_at DESC LIMIT ?
  `, [limit]);
}
