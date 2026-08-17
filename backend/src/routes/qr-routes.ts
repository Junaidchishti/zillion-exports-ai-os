import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { resolveQRCode, getQRCodesForPO } from '../services/qr-service.js';

const router = Router();

router.get('/resolve/:token', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.params.token;
    const payload = await resolveQRCode(token);
    if (!payload) {
      res.status(404).json({ error: 'QR code invalid or expired. Please retry scanning or enter code manually.' });
      return;
    }
    res.json(payload);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/po/:poNumber', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const po = req.params.poNumber;
    const codes = await getQRCodesForPO(po);
    res.json(codes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
