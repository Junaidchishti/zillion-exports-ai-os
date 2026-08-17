import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Truck,
  Scissors,
  Activity,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import { AgentChatConsole } from './AgentChatConsole.js';

interface LiveExecutiveDashboardProps {
  onOpenQRScanner?: () => void;
}

export const LiveExecutiveDashboard: React.FC<LiveExecutiveDashboardProps> = ({ onOpenQRScanner }) => {
  const { language, user } = useAuth();
  const t = translations[language];
  const isGM = user?.roleCode === 'GENERAL_MANAGER';
  const isCEO = user?.roleCode === 'CEO';

  const [pipeline, setPipeline] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pipeData, bData, finData, pendingData] = await Promise.all([
        api.getProductionOverview(),
        api.getBottlenecks(),
        api.getFinanceSummary(),
        api.getPendingApprovals(),
      ]);
      setPipeline(pipeData);
      setBottlenecks(bData);
      setFinanceSummary(finData);
      setPendingApprovalsCount(pendingData.length);
    } catch (err) {
      console.error('Failed to load executive dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const totalOrdered = pipeline.reduce((a, b) => a + (b.order_qty || 0), 0);
  const totalCut = pipeline.reduce((a, b) => a + (b.cut_qty || 0), 0);
  const totalStitched = pipeline.reduce((a, b) => a + (b.stitched_qty || 0), 0);
  const totalPacked = pipeline.reduce((a, b) => a + (b.packed_qty || 0), 0);

  const filteredPipeline = pipeline.filter(
    (po) =>
      po.po_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
      po.style_code.toLowerCase().includes(searchFilter.toLowerCase()) ||
      po.customer_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb & Live Context Banner */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Company Level:</span>
        <span className="breadcrumb-node">Zillion Exports Ltd</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">
          {isCEO ? 'CEO Executive Command' : isGM ? 'General Manager Operations Hub' : 'Executive Overview'}
        </span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">
          {pipeline.length} Active Orders • {totalOrdered.toLocaleString()} Total Units
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            <Activity className="text-cyan" size={24} color="#0284c7" />
            <span>
              {isGM
                ? (language === 'ur' ? 'جنرل منیجر آپریشنز اینڈ بوٹلنیک کنٹرول' : 'General Manager Operations & Bottleneck Control')
                : (language === 'ur' ? 'ایگزیکٹو کمانڈ اور لائیو انٹیلی جنس' : 'CEO Executive Intelligence & Factory Pulse')}
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            {language === 'ur'
              ? 'حقیقی وقت کے ڈیٹا پر مبنی کمپنی گیر فیکٹری مانیٹرنگ اور بااختیار کمانڈ سسٹم'
              : 'Real-time single-source-of-truth factory floor tracking, departmental flows, and financial oversight.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboardData} title="Refresh Live Data">
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>{loading ? 'Refreshing...' : 'Live Sync'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="metric-grid">
        <div className="metric-card border-cyan">
          <div className="metric-label">
            <span>{t.kpiActiveOrders}</span>
            <Package size={15} color="#38bdf8" />
          </div>
          <div className="metric-value">{pipeline.length} POs</div>
          <div className="metric-subtext">{totalOrdered.toLocaleString()} Total Units Ordered</div>
        </div>

        <div className="metric-card border-emerald">
          <div className="metric-label">
            <span>{t.kpiTotalCut}</span>
            <Scissors size={15} color="#10b981" />
          </div>
          <div className="metric-value tabular-num">{totalCut.toLocaleString()}</div>
          <div className="metric-subtext">
            {Math.round((totalCut / (totalOrdered || 1)) * 100)}% Overall Cutting Progress
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="metric-label">
            <span>{t.kpiPendingApprovals}</span>
            <Clock size={15} color="#f59e0b" />
          </div>
          <div className="metric-value tabular-num">{pendingApprovalsCount}</div>
          <div className="metric-subtext">
            {pendingApprovalsCount > 0 ? 'Requires Executive Decision' : 'All clear'}
          </div>
        </div>

        <div className="metric-card border-rose">
          <div className="metric-label">
            <span>{isGM ? 'Active Bottlenecks' : 'Supplier Payables'}</span>
            <AlertTriangle size={15} color="#f43f5e" />
          </div>
          <div className="metric-value tabular-num">
            {isGM
              ? `${bottlenecks.length} Blockages`
              : `$${financeSummary?.payables?.outstandingPayables?.toLocaleString() || 0}`}
          </div>
          <div className="metric-subtext">
            {isGM
              ? 'Urgent attention required'
              : `$${financeSummary?.payables?.overduePayables?.toLocaleString() || 0} Overdue`}
          </div>
        </div>
      </div>

      {/* 2-Column Split: AI Intelligent Console & Active Bottlenecks/Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(340px, 1.2fr)', gap: '20px', marginBottom: '24px' }}>
        {/* CEO / GM AI Interactive Intelligence & Command Console */}
        <div>
          <AgentChatConsole
            department="EXECUTIVE"
            title={isGM ? 'General Manager Operational Assistant' : 'CEO Executive AI Intelligence Terminal'}
            onActionCommitted={loadDashboardData}
          />
        </div>

        {/* Live Factory Bottlenecks & Critical Alerts Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title" style={{ color: bottlenecks.length > 0 ? '#f87171' : 'var(--text-primary)' }}>
                <AlertTriangle size={17} color={bottlenecks.length > 0 ? '#ef4444' : '#10b981'} />
                <span>
                  {language === 'ur' ? 'لائیو فیکٹری رکاوٹیں اور رسک الرٹس' : 'Active Department Bottlenecks & Exceptions'}
                </span>
              </div>
              <span className={`badge ${bottlenecks.length > 0 ? 'badge-danger' : 'badge-success'}`}>
                {bottlenecks.length} Active
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bottlenecks.length === 0 ? (
                <div className="empty-state-box" style={{ padding: '32px 16px' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                  <h4>Factory Floor Clear</h4>
                  <p>All 10 manufacturing departments are operating within standard tolerance thresholds.</p>
                </div>
              ) : (
                bottlenecks.map((b, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: b.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${b.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div style={{ color: b.severity === 'HIGH' ? '#ef4444' : '#f59e0b', marginTop: '2px' }}>
                      <AlertCircle size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: b.severity === 'HIGH' ? '#f87171' : '#fbbf24' }}>
                          [{b.department}] PO {b.poNumber}
                        </span>
                        <span className={`badge ${b.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                          {b.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', marginTop: '4px' }}>
                        {b.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Financial Snapshot Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <DollarSign size={17} color="#10b981" />
                <span>Financial Ledger Pulse</span>
              </div>
              <span className="badge badge-success">Audited</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer Receivables</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }} className="tabular-num">
                  ${financeSummary?.receivables?.outstandingReceivables?.toLocaleString() || 0}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Supplier Payables</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }} className="tabular-num">
                  ${financeSummary?.payables?.outstandingPayables?.toLocaleString() || 0}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Master Wages Due</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }} className="tabular-num">
                  Rs {financeSummary?.masterPayroll?.reduce((a: any, b: any) => a + (b.balanceOutstanding || 0), 0)?.toLocaleString() || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Pipeline Flow Matrix */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="card-title">
              <Layers size={18} color="#0284c7" />
              <span>{t.productionPipeline}</span>
            </div>
            <div className="card-subtitle">
              Live progression across Cutting, Stitching, Washing, Finishing, QC, Packing, and Export Loading
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                className="console-input"
                style={{ paddingLeft: '32px', padding: '6px 12px 6px 32px', fontSize: '12px' }}
                placeholder="Filter PO or Style..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
            </div>
            <span className="badge badge-info">{filteredPipeline.length} POs</span>
          </div>
        </div>

        <div className="table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>{t.poNumber}</th>
                <th>{t.customer}</th>
                <th>Style / Fabric</th>
                <th>Order Baseline</th>
                <th>Cutting</th>
                <th>Stitching</th>
                <th>Washing</th>
                <th>Finishing</th>
                <th>Quality (QC)</th>
                <th>Packing</th>
                <th>Target Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPipeline.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No matching production orders found.
                  </td>
                </tr>
              ) : (
                filteredPipeline.map((po) => (
                  <tr key={po.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {po.po_number}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{po.customer_name}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{po.style_code}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{po.color_name}</div>
                    </td>
                    <td style={{ fontWeight: 700 }} className="tabular-num">
                      {po.order_qty.toLocaleString()} pcs
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="tabular-num" style={{ fontSize: '12px', fontWeight: 600 }}>{po.cut_qty}</span>
                        <div style={{ width: '45px', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, po.cutProgress)}%`, backgroundColor: '#38bdf8' }} />
                        </div>
                      </div>
                    </td>
                    <td className="tabular-num">{po.stitched_qty}</td>
                    <td className="tabular-num">{po.washed_qty}</td>
                    <td className="tabular-num">{po.finished_qty}</td>
                    <td>
                      {po.has_packing_hold > 0 ? (
                        <span className="badge badge-danger">HOLD ({po.qc_failed_qty})</span>
                      ) : (
                        <span className="badge badge-success">{po.qc_passed_qty} Pass</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="tabular-num" style={{ fontSize: '12px', fontWeight: 600 }}>{po.packed_qty}</span>
                        <div style={{ width: '45px', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, po.finalProgress)}%`, backgroundColor: '#10b981' }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: po.isDelayed ? '#f87171' : 'var(--text-secondary)' }}>
                        {po.target_delivery_date}
                      </div>
                      {po.isDelayed && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>DELAY RISK</span>}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          po.status === 'IN_PRODUCTION'
                            ? 'badge-info'
                            : po.status === 'APPROVED'
                            ? 'badge-success'
                            : 'badge-warning'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
