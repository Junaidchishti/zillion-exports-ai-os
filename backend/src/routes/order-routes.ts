import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import {
  parseCustomerOrderEmail,
  submitOrderForMerchandisingReview,
  approveOrderByMerchandiser,
  approveOrderByCeo,
} from '../services/order-intake-service.js';

const router = Router();

// 1. Parse incoming customer order email into structured BOM draft
router.post('/email-intake', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { emailSubject, emailBody } = req.body;
    if (!emailBody) {
      res.status(400).json({ error: 'Email content is required for order intake parsing.' });
      return;
    }

    const extracted = parseCustomerOrderEmail(emailSubject || 'Customer PO Intake', emailBody);
    res.json(extracted);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Submit extracted order for Merchandising Officer review
router.post('/submit-draft', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { extractedOrder } = req.body;
    if (!extractedOrder || !extractedOrder.poNumber) {
      res.status(400).json({ error: 'Missing structured order payload.' });
      return;
    }

    const orderRecord = await submitOrderForMerchandisingReview(extractedOrder, req.user!.id);
    res.json(orderRecord);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Merchandising Officer approval
router.post('/:id/merch-approve', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const updated = await approveOrderByMerchandiser(orderId, req.user!.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. CEO Final Approval (Releases order into production)
router.post('/:id/ceo-approve', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.roleCode !== 'CEO') {
      res.status(403).json({ error: 'Unauthorized: Only the CEO account can grant final production release approval.' });
      return;
    }

    const orderId = parseInt(req.params.id, 10);
    const updated = await approveOrderByCeo(orderId, req.user!.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
