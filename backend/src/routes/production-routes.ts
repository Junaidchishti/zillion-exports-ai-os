import { Router } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth-middleware.js';
import { query, queryOne } from '../db/connection.js';
import { getPOProgressOverview, getDepartmentBottlenecks } from '../services/analytics-service.js';

const router = Router();

router.get('/overview', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const matrix = await getPOProgressOverview();
    res.json(matrix);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bottlenecks', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const bottlenecks = await getDepartmentBottlenecks();
    res.json(bottlenecks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const orders = await query<any>(`
      SELECT o.*, c.name as customer_name, c.country,
             s.code as style_code, s.name as style_name, s.garment_type,
             COALESCE(o.fabric_requirement_spec, '100% Cotton Indigo Denim 12.5oz') as fabric_type, s.garment_type as fit_type, s.standard_consumption_meters,
             clr.name as color_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN styles s ON o.style_id = s.id
      JOIN colors clr ON o.color_id = clr.id
      ORDER BY o.created_at DESC
    `);

    const enriched = await Promise.all(
      orders.map(async (ord) => {
        const breakdown = await query<any>(
          `SELECT osb.quantity, s.size_label
           FROM order_size_breakdowns osb
           JOIN sizes s ON osb.size_id = s.id
           WHERE osb.order_id = ?
           ORDER BY s.sort_order`,
          [ord.id]
        );
        return { ...ord, sizeBreakdown: breakdown };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/styles', authMiddleware, async (req, res) => {
  try {
    const styles = await query('SELECT * FROM styles ORDER BY code');
    res.json(styles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
