import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest, requireDepartmentOrExecutive } from '../middleware/auth-middleware.js';
import {
  recordInventoryMovement,
  checkInNewFabricRoll,
  getAllAccessories,
  getRecentInventoryTransactions,
} from '../services/store-service.js';

const router = Router();

router.get('/accessories', authMiddleware, requireDepartmentOrExecutive('STORE'), async (req: AuthenticatedRequest, res) => {
  try {
    const list = await getAllAccessories();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', authMiddleware, requireDepartmentOrExecutive('STORE'), async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await getRecentInventoryTransactions(limit);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/movement', authMiddleware, requireDepartmentOrExecutive('STORE'), async (req: AuthenticatedRequest, res) => {
  try {
    const { transactionType, itemCategory, rollId, accessoryId, quantity, fromLocation, toLocation, referencePo, notes } = req.body;
    const movement = await recordInventoryMovement({
      transactionType,
      itemCategory,
      rollId,
      accessoryId,
      quantity,
      fromLocation,
      toLocation,
      referencePo,
      notes,
      userId: req.user!.id,
      userRole: req.user!.roleCode,
    });
    res.json(movement);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/check-in-roll', authMiddleware, requireDepartmentOrExecutive('STORE'), async (req: AuthenticatedRequest, res) => {
  try {
    const { rollBarcode, supplierId, fabricType, shadeColor, lotBatchNumber, originalLengthMeters, warehouseLocation } = req.body;
    const newRoll = await checkInNewFabricRoll({
      rollBarcode,
      supplierId: supplierId || 2,
      fabricType,
      shadeColor: shadeColor || 'Dark Indigo Blue',
      lotBatchNumber,
      originalLengthMeters,
      warehouseLocation,
      userId: req.user!.id,
      userRole: req.user!.roleCode,
    });
    res.json(newRoll);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
