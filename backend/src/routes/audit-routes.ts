import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { getRecentAuditLogs } from '../services/audit-service.js';

const router = Router();

router.get('/logs', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const entity = req.query.entity as string | undefined;
    const po = req.query.po as string | undefined;

    const logs = await getRecentAuditLogs(limit, entity, po);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
