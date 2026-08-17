import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest, requireRoles } from '../middleware/auth-middleware.js';
import { getPendingApprovals, reviewAllocationRequest, createAllocationRequest, getUserRequests } from '../services/approval-service.js';

const router = Router();

// Department user's personal / departmental request history
router.get('/my-requests', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await getUserRequests(req.user!.id, req.user!.departmentCode);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Executive approval queue (Strictly CEO and GM)
router.get('/pending', authMiddleware, requireRoles('CEO', 'GENERAL_MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const list = await getPendingApprovals();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Review decision (Strictly CEO and GM)
router.post('/review', authMiddleware, requireRoles('CEO', 'GENERAL_MANAGER'), async (req: AuthenticatedRequest, res) => {
  try {
    const { requestId, decision, comments } = req.body;
    if (!requestId || !decision) {
      res.status(400).json({ error: 'Missing requestId or decision.' });
      return;
    }

    const result = await reviewAllocationRequest(
      parseInt(requestId, 10),
      decision as 'APPROVED' | 'REJECTED',
      req.user!.id,
      req.user!.roleCode,
      comments
    );

    res.json(result);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Create new request
router.post('/request', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestType, fromDept, toDept, poNumber, quantity, styleId, colorId, priority, reason, requiredDate, payloadDetails } = req.body;
    const reqRecord = await createAllocationRequest({
      requestType: requestType || 'MATERIAL_ISSUE',
      fromDept: fromDept || req.user!.departmentCode,
      toDept: toDept || 'STORE',
      poNumber,
      quantity: parseFloat(quantity) || 1,
      styleId: styleId ? parseInt(styleId, 10) : undefined,
      colorId: colorId ? parseInt(colorId, 10) : undefined,
      requestedBy: req.user!.id,
      priority: priority || 'NORMAL',
      reason,
      requiredDate,
      payloadDetails,
    });
    res.json(reqRecord);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
