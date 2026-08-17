import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest, requireDepartmentOrExecutive } from '../middleware/auth-middleware.js';
import { query, queryOne, execute } from '../db/connection.js';
import { getCuttingAnalytics } from '../services/analytics-service.js';
import { checkRecordLock, assertRecordCanBeEdited } from '../services/lock-service.js';
import { logAction } from '../services/audit-service.js';

const router = Router();

router.get('/entries', authMiddleware, requireDepartmentOrExecutive('CUTTING'), async (req: AuthenticatedRequest, res) => {
  try {
    const entries = await query<any>(`
      SELECT ce.*, s.name as style_name, s.code as style_code,
             clr.name as color_name, fr.roll_barcode, fr.fabric_type, u.full_name as cutting_master_name
      FROM cutting_entries ce
      JOIN styles s ON ce.style_id = s.id
      JOIN colors clr ON ce.color_id = clr.id
      JOIN fabric_rolls fr ON ce.fabric_roll_id = fr.id
      JOIN users u ON ce.cutting_master_id = u.id
      ORDER BY ce.created_at DESC
    `);

    // Attach real-time lock status and size breakdown
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const lockStatus = await checkRecordLock('cutting_entries', entry.id);
        const sizes = await query<any>(
          `SELECT csb.quantity, s.size_label
           FROM cutting_size_breakdown csb
           JOIN sizes s ON csb.size_id = s.id
           WHERE csb.cutting_entry_id = ?
           ORDER BY s.sort_order`,
          [entry.id]
        );

        return {
          ...entry,
          lockStatus,
          sizeBreakdown: sizes,
        };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rolls', authMiddleware, requireDepartmentOrExecutive('CUTTING'), async (req: AuthenticatedRequest, res) => {
  try {
    const rolls = await query<any>(`
      SELECT fr.*, s.name as supplier_name
      FROM fabric_rolls fr
      JOIN suppliers s ON fr.supplier_id = s.id
      ORDER BY fr.remaining_length_meters DESC
    `);
    res.json(rolls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', authMiddleware, requireDepartmentOrExecutive('CUTTING'), async (req: AuthenticatedRequest, res) => {
  try {
    const analytics = await getCuttingAnalytics();
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update cutting entry within 1-hour grace window (or CEO override)
router.put('/entry/:id', authMiddleware, requireDepartmentOrExecutive('CUTTING'), async (req: AuthenticatedRequest, res) => {
  try {
    const entryId = parseInt(req.params.id, 10);
    const { totalPiecesCut, wasteMeters, notes, reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'A valid reason is required for editing a production record.' });
      return;
    }

    // Assert lock status
    await assertRecordCanBeEdited('cutting_entries', entryId, req.user!.roleCode);

    const oldRecord = await queryOne('SELECT * FROM cutting_entries WHERE id = ?', [entryId]);
    if (!oldRecord) {
      res.status(404).json({ error: 'Cutting record not found.' });
      return;
    }

    await execute(
      `UPDATE cutting_entries
       SET total_pieces_cut = COALESCE(?, total_pieces_cut),
           waste_meters = COALESCE(?, waste_meters),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [totalPiecesCut, wasteMeters, notes, entryId]
    );

    const updatedRecord = await queryOne('SELECT * FROM cutting_entries WHERE id = ?', [entryId]);

    // Record immutable audit log
    await logAction({
      userId: req.user!.id,
      userRole: req.user!.roleCode,
      action: 'CUTTING_ENTRY_EDITED',
      entityName: 'CUTTING_ENTRY',
      entityId: String(entryId),
      oldData: oldRecord,
      newData: updatedRecord,
      reason,
    });

    res.json({
      message: 'Cutting record successfully corrected within grace window.',
      record: updatedRecord,
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

export default router;
