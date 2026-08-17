import { query, queryOne } from '../db/connection.js';

export async function getPOProgressOverview(poNumber?: string): Promise<any[]> {
  let sql = `
    SELECT o.id, o.po_number, o.order_qty, o.target_delivery_date, o.status,
           c.name as customer_name, s.code as style_code, s.name as style_name, clr.name as color_name,
           (SELECT COALESCE(SUM(total_pieces_cut), 0) FROM cutting_entries WHERE po_number = o.po_number) as cut_qty,
           (SELECT COALESCE(SUM(completed_qty), 0) FROM stitching_entries WHERE po_number = o.po_number) as stitched_qty,
           (SELECT COALESCE(SUM(processed_qty), 0) FROM washing_entries WHERE po_number = o.po_number) as washed_qty,
           (SELECT COALESCE(SUM(final_passed_qty), 0) FROM finishing_entries WHERE po_number = o.po_number) as finished_qty,
           (SELECT COALESCE(SUM(passed_qty), 0) FROM qc_entries WHERE po_number = o.po_number) as qc_passed_qty,
           (SELECT COALESCE(SUM(failed_qty), 0) FROM qc_entries WHERE po_number = o.po_number) as qc_failed_qty,
           (SELECT COALESCE(SUM(is_packing_hold), 0) FROM qc_entries WHERE po_number = o.po_number) as has_packing_hold,
           (SELECT COALESCE(SUM(total_pieces), 0) FROM packing_entries WHERE po_number = o.po_number) as packed_qty,
           (SELECT COALESCE(SUM(total_pieces), 0) FROM shipment_entries WHERE po_number = o.po_number) as shipped_qty
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN styles s ON o.style_id = s.id
    JOIN colors clr ON o.color_id = clr.id
  `;

  const params: any[] = [];
  if (poNumber) {
    sql += ' WHERE o.po_number = ?';
    params.push(poNumber);
  }
  sql += ' ORDER BY o.target_delivery_date ASC';

  const results = await query<any>(sql, params);

  return results.map((r) => {
    const cutProgress = Math.min(100, Math.round((r.cut_qty / (r.order_qty || 1)) * 100));
    const finalProgress = Math.min(100, Math.round((r.packed_qty / (r.order_qty || 1)) * 100));
    const isDelayed = new Date(r.target_delivery_date) < new Date() && r.packed_qty < r.order_qty;

    return {
      ...r,
      cutProgress,
      finalProgress,
      isDelayed,
      remainingToCut: Math.max(0, r.order_qty - r.cut_qty),
      remainingToPack: Math.max(0, r.order_qty - r.packed_qty),
    };
  });
}

export async function getCuttingAnalytics(): Promise<any> {
  const summary = await queryOne<any>(`
    SELECT 
      COALESCE(SUM(total_pieces_cut), 0) as totalPiecesCut,
      COALESCE(SUM(fabric_issued_meters), 0) as totalFabricIssued,
      COALESCE(SUM(fabric_consumed_meters), 0) as totalFabricConsumed,
      COALESCE(SUM(waste_meters), 0) as totalWasteMeters,
      COALESCE(AVG(waste_percentage), 0) as avgWastePercentage,
      COUNT(DISTINCT po_number) as activeOrdersCount,
      COUNT(DISTINCT fabric_roll_id) as rollsUtilized
    FROM cutting_entries
  `);

  const styleWaste = await query<any>(`
    SELECT s.code as styleCode, s.name as styleName,
           SUM(ce.total_pieces_cut) as cutPieces,
           SUM(ce.fabric_consumed_meters) as fabricConsumed,
           AVG(ce.waste_percentage) as avgWastePct
    FROM cutting_entries ce
    JOIN styles s ON ce.style_id = s.id
    GROUP BY s.code, s.name
  `);

  const availableRolls = await query<any>(`
    SELECT id, roll_barcode, fabric_type, shade_color, lot_batch_number,
           original_length_meters, remaining_length_meters, warehouse_location, status
    FROM fabric_rolls
    ORDER BY remaining_length_meters DESC
  `);

  return {
    summary: {
      ...summary,
      avgWastePercentage: Number(Number(summary?.avgWastePercentage || 0).toFixed(2)),
      totalFabricIssued: Number(Number(summary?.totalFabricIssued || 0).toFixed(1)),
      totalFabricConsumed: Number(Number(summary?.totalFabricConsumed || 0).toFixed(1)),
      totalWasteMeters: Number(Number(summary?.totalWasteMeters || 0).toFixed(1)),
    },
    styleWaste,
    availableRolls,
  };
}

export async function getFinancialSummary(): Promise<any> {
  const payables = await queryOne<any>(`
    SELECT 
      COALESCE(SUM(invoice_amount), 0) as totalInvoiced,
      COALESCE(SUM(paid_amount), 0) as totalPaid,
      COALESCE(SUM(invoice_amount - paid_amount), 0) as outstandingPayables,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_TIMESTAMP AND (invoice_amount - paid_amount) > 0 THEN (invoice_amount - paid_amount) ELSE 0 END), 0) as overduePayables
    FROM supplier_invoices
  `);

  const receivables = await queryOne<any>(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as totalInvoiced,
      COALESCE(SUM(received_amount), 0) as totalReceived,
      COALESCE(SUM(total_amount - received_amount), 0) as outstandingReceivables,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_TIMESTAMP AND (total_amount - received_amount) > 0 THEN (total_amount - received_amount) ELSE 0 END), 0) as overdueReceivables
    FROM customer_receivables
  `);

  const masterPayroll = await query<any>(`
    SELECT pm.name as masterName, pm.department_code as department,
           COALESCE(SUM(mpl.approved_quantity), 0) as totalApprovedQty,
           COALESCE(SUM(mpl.net_payable), 0) as totalGrossPayable,
           COALESCE((SELECT SUM(amount) FROM master_payments WHERE master_id = pm.id), 0) as totalPaid,
           COALESCE(SUM(mpl.net_payable) - COALESCE((SELECT SUM(amount) FROM master_payments WHERE master_id = pm.id), 0), 0) as balanceOutstanding
    FROM production_masters pm
    LEFT JOIN master_production_ledger mpl ON pm.id = mpl.master_id
    GROUP BY pm.id, pm.name, pm.department_code
  `);

  return {
    payables,
    receivables,
    masterPayroll,
  };
}

export async function getDepartmentBottlenecks(): Promise<any[]> {
  const pos = await getPOProgressOverview();
  const bottlenecks: any[] = [];

  for (const po of pos) {
    if (po.cut_qty > po.stitched_qty + 500) {
      bottlenecks.push({
        poNumber: po.po_number,
        department: 'STITCHING',
        backlogPieces: po.cut_qty - po.stitched_qty,
        message: `Stitching backlog: ${po.cut_qty - po.stitched_qty} cut pieces waiting for assembly`,
        severity: 'MEDIUM',
      });
    }
    if (po.stitched_qty > po.washed_qty + 300) {
      bottlenecks.push({
        poNumber: po.po_number,
        department: 'WASHING',
        backlogPieces: po.stitched_qty - po.washed_qty,
        message: `Washing backlog: ${po.stitched_qty - po.washed_qty} stitched pieces waiting for wash batch`,
        severity: 'MEDIUM',
      });
    }
    if (po.has_packing_hold > 0) {
      bottlenecks.push({
        poNumber: po.po_number,
        department: 'QC',
        backlogPieces: po.qc_failed_qty,
        message: `CRITICAL PACKING HOLD active on PO ${po.po_number} due to QC defects. Dispatch suspended.`,
        severity: 'HIGH',
      });
    }
  }

  // Check for Cutting Excess Exceptions
  const excessEntries = await query<any>(`
    SELECT ce.*, o.order_qty
    FROM cutting_entries ce
    JOIN orders o ON ce.po_number = o.po_number
    WHERE ce.status = 'EXCESS_EXCEPTION'
  `);

  for (const exc of excessEntries) {
    bottlenecks.push({
      poNumber: exc.po_number,
      department: 'CUTTING',
      backlogPieces: exc.total_pieces_cut,
      message: `CUTTING EXCESS EXCEPTION: ${exc.total_pieces_cut} pcs cut on PO ${exc.po_number} (Order Baseline: ${exc.order_qty} pcs). Exceeds 5% buffer. Requires GM review.`,
      severity: 'HIGH',
    });
  }

  return bottlenecks;
}
