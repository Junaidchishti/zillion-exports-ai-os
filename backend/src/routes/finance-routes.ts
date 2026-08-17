import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest, requireFinanceOrExecutive } from '../middleware/auth-middleware.js';
import { query, queryOne } from '../db/connection.js';
import { getFinancialSummary } from '../services/analytics-service.js';
import { getAllMasterRates, createOrUpdateMasterRate, recordMasterPayment } from '../services/finance-service.js';

const router = Router();

router.get('/summary', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await getFinancialSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/supplier-invoices', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const invoices = await query<any>(`
      SELECT si.*, s.name as supplier_name, s.code as supplier_code, s.payment_terms_days
      FROM supplier_invoices si
      JOIN suppliers s ON si.supplier_id = s.id
      ORDER BY si.due_date ASC
    `);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customer-receivables', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const receivables = await query<any>(`
      SELECT cr.*, c.name as customer_name, c.country
      FROM customer_receivables cr
      JOIN customers c ON cr.customer_id = c.id
      ORDER BY cr.due_date ASC
    `);
    res.json(receivables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/production-masters', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const masters = await query<any>(`
      SELECT pm.*,
             (SELECT json_group_array(json_object('operation', operation_name, 'rate', rate_per_piece))
              FROM master_rates WHERE master_id = pm.id) as rates_json
      FROM production_masters pm
    `);
    res.json(masters);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Master Rates CRUD
router.get('/rates', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const rates = await getAllMasterRates();
    res.json(rates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rates', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const { masterId, departmentCode, styleId, operationName, ratePerPiece } = req.body;
    const rateRecord = await createOrUpdateMasterRate({
      masterId: parseInt(masterId, 10),
      departmentCode,
      styleId: styleId ? parseInt(styleId, 10) : undefined,
      operationName,
      ratePerPiece: parseFloat(ratePerPiece),
      userId: req.user!.id,
      userRole: req.user!.roleCode,
    });
    res.json(rateRecord);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/disburse-payment', authMiddleware, requireFinanceOrExecutive(), async (req: AuthenticatedRequest, res) => {
  try {
    const { masterId, amount, paymentMethod, referenceNo } = req.body;
    const payment = await recordMasterPayment({
      masterId: parseInt(masterId, 10),
      amount: parseFloat(amount),
      paymentMethod,
      referenceNo,
      paidByUserId: req.user!.id,
      userRole: req.user!.roleCode,
    });
    res.json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
