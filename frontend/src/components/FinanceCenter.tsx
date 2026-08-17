import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit2, CheckCircle2, ShieldCheck, TrendingUp, RefreshCw, Send, Layers, Clock, AlertTriangle, FileText } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';

export const FinanceCenter: React.FC = () => {
  const { language, user } = useAuth();
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'PAYROLL' | 'PAYABLES' | 'RECEIVABLES'>('PAYROLL');
  const [summary, setSummary] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [masters, setMasters] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Rate Config Modal State
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [rateMasterId, setRateMasterId] = useState<string>('1');
  const [rateDept, setRateDept] = useState<string>('CUTTING');
  const [rateStyleId, setRateStyleId] = useState<string>('1');
  const [rateOpName, setRateOpName] = useState<string>('Standard Lay & Cutting');
  const [ratePerPiece, setRatePerPiece] = useState<number>(4.50);

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutMasterId, setPayoutMasterId] = useState<string>('1');
  const [payoutAmount, setPayoutAmount] = useState<number>(10000);
  const [payoutMethod, setPayoutMethod] = useState<string>('BANK_TRANSFER');

  const loadFinanceData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sumData, invData, recData, mastData, ratesData, stylesData] = await Promise.all([
        api.getFinanceSummary(),
        api.getSupplierInvoices(),
        api.getCustomerReceivables(),
        api.getProductionMasters(),
        api.getMasterRates(),
        api.getStyles(),
      ]);
      setSummary(sumData);
      setInvoices(invData);
      setReceivables(recData);
      setMasters(mastData);
      setRates(ratesData);
      setStyles(stylesData);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadFinanceData();
  }, [user]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveMasterRate({
        masterId: parseInt(rateMasterId, 10),
        departmentCode: rateDept,
        styleId: parseInt(rateStyleId, 10),
        operationName: rateOpName,
        ratePerPiece,
      });
      setShowRateModal(false);
      await loadFinanceData();
    } catch (err: any) {
      alert(`Error saving rate: ${err.message}`);
    }
  };

  const handleDisbursePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.disburseMasterPayment({
        masterId: parseInt(payoutMasterId, 10),
        amount: payoutAmount,
        paymentMethod: payoutMethod,
      });
      setShowPayoutModal(false);
      await loadFinanceData();
    } catch (err: any) {
      alert(`Error recording payout: ${err.message}`);
    }
  };

  const totalMasterDue = summary?.masterPayroll?.reduce((a: any, b: any) => a + (b.balanceOutstanding || 0), 0) || 0;

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb & Hierarchy Banner */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Finance:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">Corporate Accounts</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">Financial Ledger & Piece-Rate Payroll</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node" style={{ color: '#94a3b8' }}>
          Officer: {user?.fullName} ({user?.roleCode})
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            <DollarSign className="text-cyan" size={24} color="#10b981" />
            <span>Finance & Master Piece-Rates Center</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            Supplier payables (30/60/90 days), customer export receivables, and production master piece-rate payroll
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowRateModal(true)}>
            <Plus size={14} />
            <span>Configure Master Rate</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayoutModal(true)}>
            <Send size={14} />
            <span>Record Wage Payout</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadFinanceData}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Sync Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid">
        <div className="metric-card border-emerald">
          <div className="metric-label">
            <span>Customer Receivables</span>
            <TrendingUp size={14} color="#10b981" />
          </div>
          <div className="metric-value tabular-num">${summary?.receivables?.outstandingReceivables?.toLocaleString() || 0}</div>
          <div className="metric-subtext">${summary?.receivables?.overdueReceivables?.toLocaleString() || 0} Overdue</div>
        </div>

        <div className="metric-card border-amber">
          <div className="metric-label">
            <span>Supplier Payables</span>
            <Clock size={14} color="#f59e0b" />
          </div>
          <div className="metric-value tabular-num">${summary?.payables?.outstandingPayables?.toLocaleString() || 0}</div>
          <div className="metric-subtext">${summary?.payables?.overduePayables?.toLocaleString() || 0} Overdue</div>
        </div>

        <div className="metric-card border-cyan">
          <div className="metric-label">
            <span>Master Wages Due</span>
            <DollarSign size={14} color="#38bdf8" />
          </div>
          <div className="metric-value tabular-num">Rs {totalMasterDue.toLocaleString()}</div>
          <div className="metric-subtext">{summary?.masterPayroll?.length || 0} Production Masters Active</div>
        </div>

        <div className="metric-card border-rose">
          <div className="metric-label">
            <span>Piece-Rates Configured</span>
            <FileText size={14} color="#f43f5e" />
          </div>
          <div className="metric-value tabular-num">{rates.length} Operations</div>
          <div className="metric-subtext">Department Piece Contracts</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-item ${activeTab === 'PAYROLL' ? 'active' : ''}`}
          onClick={() => setActiveTab('PAYROLL')}
        >
          <DollarSign size={15} />
          <span>Production Master Payroll & Rates ({rates.length})</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'PAYABLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('PAYABLES')}
        >
          <Clock size={15} />
          <span>Supplier Payables & Terms ({invoices.length})</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'RECEIVABLES' ? 'active' : ''}`}
          onClick={() => setActiveTab('RECEIVABLES')}
        >
          <TrendingUp size={15} />
          <span>Customer Export Receivables ({receivables.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCTION MASTER PAYROLL & RATES */}
      {activeTab === 'PAYROLL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(340px, 1fr)', gap: '20px' }}>
          {/* Production Master Wages Ledger */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <TrendingUp size={17} color="#0284c7" />
                <span>Master Piece-Rate Wages & Balance Due</span>
              </div>
              <span className="badge badge-info">Audited Piece Counts</span>
            </div>

            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Master Name</th>
                    <th>Department</th>
                    <th>Approved Pieces</th>
                    <th>Gross Accrued</th>
                    <th>Disbursed</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.masterPayroll?.map((m: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{m.masterName}</td>
                      <td><span className="badge badge-info">{m.department}</span></td>
                      <td style={{ fontWeight: 600 }} className="tabular-num">{m.totalApprovedQty?.toLocaleString()} pcs</td>
                      <td className="tabular-num">Rs {m.totalGrossPayable?.toLocaleString()}</td>
                      <td style={{ color: '#10b981' }} className="tabular-num">Rs {m.totalPaid?.toLocaleString()}</td>
                      <td style={{ fontWeight: 800, color: '#a78bfa' }} className="tabular-num">Rs {m.balanceOutstanding?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Master Piece-Rates Matrix Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <DollarSign size={17} color="#10b981" />
                <span>Configured Operation Rates per Piece</span>
              </div>
              <span className="badge badge-success">{rates.length} Rates</span>
            </div>

            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Master</th>
                    <th>Dept</th>
                    <th>Operation Name</th>
                    <th>Rate / Piece</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.master_name}</td>
                      <td><span className="badge badge-info">{r.department_code}</span></td>
                      <td>{r.operation_name}</td>
                      <td style={{ fontWeight: 800, color: '#38bdf8' }} className="tabular-num">Rs {r.rate_per_piece.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER PAYABLES */}
      {activeTab === 'PAYABLES' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <ShieldCheck size={17} color="#f59e0b" />
              <span>Supplier Invoices & Payment Terms (30 / 60 / 90 Days)</span>
            </div>
            <span className="badge badge-warning">{invoices.length} Invoices</span>
          </div>

          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Supplier</th>
                  <th>PO Reference</th>
                  <th>Amount</th>
                  <th>Terms</th>
                  <th>Due Date</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 600 }}>{inv.supplier_name}</td>
                    <td className="mono">{inv.po_number || 'FABRIC_STOCK'}</td>
                    <td style={{ fontWeight: 700 }} className="tabular-num">${inv.invoice_amount?.toLocaleString()}</td>
                    <td>{inv.payment_terms_days} Days</td>
                    <td>{inv.due_date}</td>
                    <td className="tabular-num">${inv.paid_amount?.toLocaleString()}</td>
                    <td style={{ fontWeight: 800, color: inv.outstanding_amount > 0 ? '#f87171' : '#10b981' }} className="tabular-num">
                      ${(inv.invoice_amount - inv.paid_amount)?.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${inv.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER RECEIVABLES */}
      {activeTab === 'RECEIVABLES' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={17} color="#0284c7" />
              <span>Customer Export Invoices & Payment Tracking</span>
            </div>
            <span className="badge badge-info">{receivables.length} Export Receivables</span>
          </div>

          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Invoice / LC #</th>
                  <th>Customer</th>
                  <th>PO Number</th>
                  <th>Total Amount</th>
                  <th>Received</th>
                  <th>Outstanding</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((rec) => (
                  <tr key={rec.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{rec.invoice_number}</td>
                    <td style={{ fontWeight: 600 }}>{rec.customer_name}</td>
                    <td className="mono">{rec.po_number}</td>
                    <td style={{ fontWeight: 700 }} className="tabular-num">${rec.total_amount?.toLocaleString()}</td>
                    <td style={{ color: '#10b981' }} className="tabular-num">${rec.received_amount?.toLocaleString()}</td>
                    <td style={{ fontWeight: 800, color: '#38bdf8' }} className="tabular-num">${(rec.total_amount - rec.received_amount)?.toLocaleString()}</td>
                    <td>{rec.due_date}</td>
                    <td>
                      <span className={`badge ${rec.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rate Config Modal */}
      {showRateModal && (
        <div className="modal-overlay" onClick={() => setShowRateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="#10b981" />
                <span>Configure Master Piece-Rate</span>
              </h3>
            </div>

            <form onSubmit={handleSaveRate}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Production Master
                </label>
                <select
                  className="console-input"
                  value={rateMasterId}
                  onChange={(e) => setRateMasterId(e.target.value)}
                >
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.department_code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Department
                  </label>
                  <select
                    className="console-input"
                    value={rateDept}
                    onChange={(e) => setRateDept(e.target.value)}
                  >
                    <option value="CUTTING">CUTTING</option>
                    <option value="STITCHING">STITCHING</option>
                    <option value="WASHING">WASHING</option>
                    <option value="FINISHING">FINISHING</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Garment Style
                  </label>
                  <select
                    className="console-input"
                    value={rateStyleId}
                    onChange={(e) => setRateStyleId(e.target.value)}
                  >
                    {styles.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Operation / Work Type
                </label>
                <input
                  type="text"
                  className="console-input"
                  value={rateOpName}
                  onChange={(e) => setRateOpName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Contracted Rate per Piece (PKR)
                </label>
                <input
                  type="number"
                  step="0.25"
                  className="console-input"
                  value={ratePerPiece}
                  onChange={(e) => setRatePerPiece(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Piece-Rate Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} color="#0284c7" />
                <span>Disburse Production Master Wage Payout</span>
              </h3>
            </div>

            <form onSubmit={handleDisbursePayout}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Recipient Production Master
                </label>
                <select
                  className="console-input"
                  value={payoutMasterId}
                  onChange={(e) => setPayoutMasterId(e.target.value)}
                >
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.department_code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Disbursement Amount (PKR)
                </label>
                <input
                  type="number"
                  className="console-input"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Payment Method
                </label>
                <select
                  className="console-input"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  <option value="CASH_VOUCHER">Factory Cashier Voucher</option>
                  <option value="CHEQUE">Corporate Cheque</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayoutModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Record Payout Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
