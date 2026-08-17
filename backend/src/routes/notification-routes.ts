import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { getUserNotifications, markNotificationAsRead } from '../services/notification-service.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await getUserNotifications(req.user!.id, req.user!.roleCode);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/read', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await markNotificationAsRead(notifId, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
