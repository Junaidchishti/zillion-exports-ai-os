import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Search,
  Package,
  Info,
  ChevronDown,
  BarChart2,
  Calendar,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import { AgentChatConsole } from './AgentChatConsole.js';

export const CuttingWorkstation: React.FC = () => {
  const { language, user } = useAuth();
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SMART_ENTRY' | 'DIRECT_MATRIX' | 'HISTORY'>('OVERVIEW');
  const [entries, setEntries] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Drilldown Popover States
  const [activeDrilldown, setActiveDrilldown] = useState<'NONE' | 'TOTAL_CUT' | 'WASTE' | 'ROLLS'>('NONE');

  // History Analytics Filter
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'>('ALL');

  // Manual fast-entry state
  const [selectedPO, setSelectedPO] = useState<string>('PO-452');
  const [selectedRoll, setSelectedRoll] = useState<string>('ROLL-101');
  const [fabricIssued, setFabricIssued] = useState<number>(1320);
  const [sizeInputs, setSizeInputs] = useState<Record<string, number>>({
    '28': 200,
    '30': 400,
    '32': 400,
    '34': 0,
    '36': 0,
    '38': 0,
    '40': 0,
  });

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editPieces, setEditPieces] = useState<number>(0);
  const [editWaste, setEditWaste] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  const loadData = async (isManualSync = false) => {
    if (!user) return;
    if (isManualSync) setIsSyncing(true);
    else setLoading(true);

    try {
      const [entriesData, rollsData, ordersData, analyticsData] = await Promise.all([
        api.getCuttingEntries(),
        api.getFabricRolls(),
        api.getOrders(),
        api.getCuttingAnalytics(),
      ]);
      setEntries(entriesData);
      setRolls(rollsData);
      setOrders(ordersData);
      setAnalytics(analyticsData);
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('Failed to load cutting data:', err);
      if (isManualSync) {
        alert(`Sync Failed: ${err.message || 'Network error connecting to backend.'}`);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadData();
    const interval = setInterval(() => loadData(false), 20000);
    return () => clearInterval(interval);
  }, [user]);

  const totalCalculatedPieces = Object.values(sizeInputs).reduce((a, b) => Number(a) + Number(b), 0);
  const selectedRollObj = rolls.find((r) => r.roll_barcode === selectedRoll);
  const selectedOrderObj = orders.find((o) => o.po_number === selectedPO);

  // Live automated metrics
  const standardCons = selectedOrderObj?.standard_consumption_meters || 1.35;
  const theoreticalFabric = totalCalculatedPieces * standardCons;
  const calculatedWaste = Number(Math.max(0, fabricIssued - theoreticalFabric * 0.96).toFixed(1));
  const calculatedWastePct = fabricIssued > 0 ? Number(((calculatedWaste / fabricIssued) * 100).toFixed(2)) : 0;
  const rollBalanceAfterCut = selectedRollObj ? Number((selectedRollObj.remaining_length_meters - fabricIssued).toFixed(1)) : 0;
  const efficiency = fabricIssued > 0 ? Number(((theoreticalFabric / fabricIssued) * 100).toFixed(1)) : 100;

  const handleManualSubmit = async () => {
    try {
      const promptText = `${selectedPO}, ${selectedRoll}, ${fabricIssued} meters fabric consumed, ${totalCalculatedPieces} pieces cut with sizes: ${Object.entries(
        sizeInputs
      )
        .filter(([_, q]) => q > 0)
        .map(([s, q]) => `${s}: ${q}`)
        .join(', ')}`;

      const res = await api.chatWithAgent('CUTTING', promptText);
      if (res.requiresConfirmation && res.proposedActionPayload) {
        await api.confirmAgentAction('CUTTING', res.proposedActionPayload);
        await loadData(true);
        setActiveTab('HISTORY');
      }
    } catch (err: any) {
      alert(`Submission Error: ${err.message}`);
    }
  };

  const handleOpenEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditPieces(entry.total_pieces_cut);
    setEditWaste(entry.waste_meters);
    setEditReason('');
    setEditError('');
  };

  const handleSaveCorrection = async () => {
    if (!editReason.trim()) {
      setEditError('A specific reason for correction is strictly required for audit compliance.');
      return;
    }

    try {
      await api.updateCuttingEntry(editingEntry.id, {
        totalPiecesCut: editPieces,
        wasteMeters: editWaste,
        reason: editReason,
      });
      setEditingEntry(null);
      await loadData(true);
    } catch (err: any) {
      setEditError(err.message || 'Failed to correct record.');
    }
  };

  // Group PO Cut Quantities for KPI Drilldown
  const poCutBreakdown: Record<string, { totalCut: number; styleName: string; count: number }> = {};
  entries.forEach((e) => {
    if (e.status !== 'CANCELLED') {
      if (!poCutBreakdown[e.po_number]) {
        poCutBreakdown[e.po_number] = { totalCut: 0, styleName: e.style_name || 'Denim Jeans', count: 0 };
      }
      poCutBreakdown[e.po_number].totalCut += e.total_pieces_cut || 0;
      poCutBreakdown[e.po_number].count += 1;
    }
  });

  // Group Fabric Rolls by Color / Type
  const rollColorSummary: Record<string, { count: number; totalMeters: number }> = {};
  rolls.forEach((r) => {
    const key = `${r.fabric_type || 'Denim'} (${r.shade_color || 'Standard'})`;
    if (!rollColorSummary[key]) rollColorSummary[key] = { count: 0, totalMeters: 0 };
    rollColorSummary[key].count += 1;
    rollColorSummary[key].totalMeters += r.remaining_length_meters || 0;
  });

  // Filter Cutting History
  const now = new Date().getTime();
  const filteredEntries = entries.filter((e) => {
    if (historyFilter === 'ALL') return true;
    const entryTime = new Date(e.created_at).getTime();
    const diffHours = (now - entryTime) / (1000 * 3600);
    if (historyFilter === 'TODAY') return diffHours <= 24;
    if (historyFilter === 'YESTERDAY') return diffHours > 24 && diffHours <= 48;
    if (historyFilter === 'LAST_7_DAYS') return diffHours <= 24 * 7;
    if (historyFilter === 'LAST_30_DAYS') return diffHours <= 24 * 30;
    return true;
  });

  return (
    <div className="page-body">
      {/* Top Header without clutter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px', fontWeight: 900 }}>
            <Scissors size={24} color="#0284c7" />
            <span>Cutting Master Workstation</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            {language === 'ur'
              ? 'صنعتی کٹنگ ورک اسٹیشن - فیبرک رول کی کھپت، سائز بریک ڈاؤن اور 1 گھنٹے کا آڈٹ لاک'
              : 'Live fabric yardage, scrap calculations, size matrix planning, and 1-hour audit lock timeline.'}
          </p>
        </div>

        {/* Real Working Sync Data Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastSyncedTime && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Last synced: <strong>{lastSyncedTime}</strong>
            </span>
          )}
          <button
            type="button"
            id="btn-sync-cutting-data"
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(true)}
            disabled={isSyncing}
            title="Fetch latest database state"
          >
            <RefreshCw size={14} className={isSyncing ? 'spinner' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </div>

      {/* KPI Row with Interactive Hover/Focus Popover Drilldowns */}
      <div className="metric-grid" style={{ position: 'relative' }}>
        {/* KPI 1: TOTAL CUT */}
        <div
          className="metric-card border-cyan"
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => setActiveDrilldown(activeDrilldown === 'TOTAL_CUT' ? 'NONE' : 'TOTAL_CUT')}
        >
          <div className="metric-label">
            <span>{t.kpiTotalCut}</span>
            <div
              title="Click to view PO-wise breakdown"
              style={{ padding: '2px 4px', borderRadius: '4px', backgroundColor: 'rgba(2, 132, 199, 0.2)' }}
            >
              <Scissors size={14} color="#38bdf8" />
            </div>
          </div>
          <div className="metric-value tabular-num">{analytics?.summary?.totalPiecesCut?.toLocaleString() || 0}</div>
          <div className="metric-subtext">
            <span>{analytics?.summary?.activeOrdersCount || orders.length} Active POs</span>
            <span style={{ color: '#38bdf8', marginLeft: '6px', fontWeight: 600 }}>• View Breakdown</span>
          </div>

          {/* Drilldown Popover: Total Cut */}
          {activeDrilldown === 'TOTAL_CUT' && (
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '105%',
                left: 0,
                width: '320px',
                zIndex: 110,
                backgroundColor: '#0f172a',
                border: '1px solid #0284c7',
                borderRadius: '10px',
                padding: '14px',
                boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#38bdf8' }}>PO-Wise Cut Breakdown</span>
                <button type="button" className="btn-icon" onClick={() => setActiveDrilldown('NONE')}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {Object.keys(poCutBreakdown).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>No cut records logged yet.</div>
                ) : (
                  Object.entries(poCutBreakdown).map(([po, info]) => (
                    <div
                      key={po}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <div className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{po}</div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{info.styleName}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#f8fafc' }} className="tabular-num">
                        {info.totalCut.toLocaleString()} pcs
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800 }}>
                <span>Total Output:</span>
                <span style={{ color: '#38bdf8' }}>{analytics?.summary?.totalPiecesCut?.toLocaleString() || 0} pcs</span>
              </div>
            </div>
          )}
        </div>

        {/* KPI 2: WASTE % */}
        <div
          className="metric-card border-amber"
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => setActiveDrilldown(activeDrilldown === 'WASTE' ? 'NONE' : 'WASTE')}
        >
          <div className="metric-label">
            <span>{t.wastePct}</span>
            <div
              title="Click to view scrap meters and consumption metrics"
              style={{ padding: '2px 4px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
            >
              <Layers size={14} color="#f59e0b" />
            </div>
          </div>
          <div className="metric-value tabular-num">{analytics?.summary?.avgWastePercentage || 0}%</div>
          <div className="metric-subtext">
            <span>Total Scrap: {analytics?.summary?.totalWasteMeters || 0}m</span>
            <span style={{ color: '#f59e0b', marginLeft: '6px', fontWeight: 600 }}>• View Details</span>
          </div>

          {/* Drilldown Popover: Waste Details */}
          {activeDrilldown === 'WASTE' && (
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '105%',
                left: 0,
                width: '320px',
                zIndex: 110,
                backgroundColor: '#0f172a',
                border: '1px solid #f59e0b',
                borderRadius: '10px',
                padding: '14px',
                boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#f59e0b' }}>Scrap & Consumption Audit</span>
                <button type="button" className="btn-icon" onClick={() => setActiveDrilldown('NONE')}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Overall Waste Percentage:</span>
                  <span style={{ fontWeight: 800, color: '#f59e0b' }}>{analytics?.summary?.avgWastePercentage || 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Total Scrap Recorded:</span>
                  <span style={{ fontWeight: 800, color: '#f87171' }}>{analytics?.summary?.totalWasteMeters || 0} meters</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Standard Consumption Factor:</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8' }}>1.35 m/piece</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KPI 3: FABRIC ROLLS IN STORE */}
        <div
          className="metric-card border-emerald"
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => setActiveDrilldown(activeDrilldown === 'ROLLS' ? 'NONE' : 'ROLLS')}
        >
          <div className="metric-label">
            <span>Fabric Rolls in Store</span>
            <div
              title="Click to view available rolls and fabric inventory"
              style={{ padding: '2px 4px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
            >
              <Package size={14} color="#10b981" />
            </div>
          </div>
          <div className="metric-value tabular-num">{rolls.filter((r) => r.status === 'AVAILABLE').length} Rolls</div>
          <div className="metric-subtext">
            <span>{rolls.reduce((a, b) => a + (b.remaining_length_meters || 0), 0).toLocaleString()}m Available</span>
            <span style={{ color: '#10b981', marginLeft: '6px', fontWeight: 600 }}>• View Inventory</span>
          </div>

          {/* Drilldown Popover: Fabric Rolls Inventory */}
          {activeDrilldown === 'ROLLS' && (
            <div
              className="card"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '105%',
                right: 0,
                width: '420px',
                zIndex: 110,
                backgroundColor: '#0f172a',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '14px',
                boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#10b981' }}>Warehouse Fabric Availability</span>
                <button type="button" className="btn-icon" onClick={() => setActiveDrilldown('NONE')}>
                  <X size={13} />
                </button>
              </div>

              {/* Color/Fabric Aggregates */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {Object.entries(rollColorSummary).map(([cat, val]) => (
                  <span
                    key={cat}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                      fontWeight: 600,
                    }}
                  >
                    {cat}: {val.count} rolls ({val.totalMeters.toLocaleString()}m)
                  </span>
                ))}
              </div>

              {/* Rolls List Table */}
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="enterprise-table" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Fabric</th>
                      <th>Location</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolls.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td className="mono" style={{ fontWeight: 700, color: '#10b981' }}>{r.roll_barcode}</td>
                        <td>{r.fabric_type}</td>
                        <td>{r.warehouse_location}</td>
                        <td style={{ fontWeight: 700, color: '#f8fafc' }}>{r.remaining_length_meters}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* KPI 4: 1-HOUR EDIT WINDOW */}
        <div className="metric-card border-rose">
          <div className="metric-label">
            <span>1-Hour Edit Window</span>
            <Clock size={14} color="#f43f5e" />
          </div>
          <div className="metric-value">60 Mins</div>
          <div className="metric-subtext">
            <span>Reason-mandated correction window before immutable lock.</span>
          </div>
        </div>
      </div>

      {/* Workstation Tab Bar */}
      <div className="tab-bar" style={{ marginTop: '20px' }}>
        <button
          type="button"
          id="tab-cutting-overview"
          className={`tab-item ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
          onClick={() => setActiveTab('OVERVIEW')}
        >
          <Layers size={15} />
          <span>Operational Overview & Size Breakdown</span>
        </button>
        <button
          type="button"
          id="tab-cutting-smart"
          className={`tab-item ${activeTab === 'SMART_ENTRY' ? 'active' : ''}`}
          onClick={() => setActiveTab('SMART_ENTRY')}
        >
          <Sparkles size={15} />
          <span>Smart Voice / Text Entry</span>
        </button>
        <button
          type="button"
          id="tab-cutting-matrix"
          className={`tab-item ${activeTab === 'DIRECT_MATRIX' ? 'active' : ''}`}
          onClick={() => setActiveTab('DIRECT_MATRIX')}
        >
          <Scissors size={15} />
          <span>Direct Size Matrix Pad</span>
        </button>
        <button
          type="button"
          id="tab-cutting-history"
          className={`tab-item ${activeTab === 'HISTORY' ? 'active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          <Clock size={15} />
          <span>Cutting History & Analytics ({entries.length})</span>
        </button>
      </div>

      {/* TAB 1: OPERATIONAL OVERVIEW & SIZE-WISE PO BREAKDOWN */}
      {activeTab === 'OVERVIEW' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={17} color="#0284c7" />
              <span>Target Production Orders Ready for Cutting</span>
            </div>
            <span className="badge badge-info">{orders.length} Active Orders</span>
          </div>

          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Customer</th>
                  <th>Style</th>
                  <th>Fabric</th>
                  <th>Color</th>
                  <th>Size Breakdown</th>
                  <th>Total Qty</th>
                  <th>Max Allowed (105%)</th>
                  <th>Production Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const cutSoFar = poCutBreakdown[o.po_number]?.totalCut || 0;
                  const pct = o.order_qty > 0 ? Math.min(100, Math.round((cutSoFar / o.order_qty) * 100)) : 0;

                  return (
                    <tr key={o.id}>
                      <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{o.po_number}</td>
                      <td>{o.customer_name}</td>
                      <td style={{ fontWeight: 600 }}>{o.style_name || o.style_code}</td>
                      <td style={{ color: '#94a3b8' }}>{o.fabric_type || 'Denim Twill'}</td>
                      <td>{o.color_name || 'Indigo'}</td>
                      <td>
                        {o.sizeBreakdown && o.sizeBreakdown.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {o.sizeBreakdown.map((sb: any, idx: number) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                {sb.size_label}: {sb.quantity}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>28: 200, 30: 400, 32: 400</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }} className="tabular-num">{o.order_qty.toLocaleString()} pcs</td>
                      <td style={{ color: '#a78bfa', fontWeight: 600 }} className="tabular-num">
                        {Math.round(o.order_qty * 1.05).toLocaleString()} pcs
                      </td>
                      <td style={{ minWidth: '160px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                          <span>{cutSoFar.toLocaleString()} / {o.order_qty.toLocaleString()}</span>
                          <span style={{ fontWeight: 700, color: pct >= 100 ? '#10b981' : '#38bdf8' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#10b981' : '#0284c7',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${o.status === 'APPROVED' ? 'badge-success' : 'badge-info'}`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SMART AI ENTRY */}
      {activeTab === 'SMART_ENTRY' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(340px, 1fr)', gap: '20px' }}>
          <div>
            <AgentChatConsole
              department="CUTTING"
              title="Cutting Master AI Voice & Text Console"
              onActionCommitted={() => loadData(true)}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Sparkles size={17} color="#0284c7" />
                <span>Cutting Voice Entry Guide</span>
              </div>
              <span className="badge badge-success">Zero Manual Math</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '12px' }}>
                Speak or type naturally in <strong>English</strong> or <strong>اردو (Urdu)</strong>.
              </p>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px' }}>
                  Urdu Example:
                </div>
                <div className="mono" style={{ fontSize: '12px', color: '#f8fafc' }}>
                  "PO 452، Roll 101 میں سے 1320 میٹر، 1000 پیس کٹ کیے، سائز 28: 200، 30: 400، 32: 400"
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px' }}>
                  English Example:
                </div>
                <div className="mono" style={{ fontSize: '12px', color: '#f8fafc' }}>
                  "PO 452, Roll 101, 1320 meters, 1000 pieces with sizes 28: 200, 30: 400, 32: 400"
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px' }}>
                <CheckCircle2 size={16} />
                <span>Automated scrap meters, efficiency %, and roll balances are computed instantly.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DIRECT SIZE MATRIX PAD */}
      {activeTab === 'DIRECT_MATRIX' && (
        <div className="card" style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div className="card-header">
            <div className="card-title">
              <Scissors size={17} color="#0284c7" />
              <span>Direct Lay Planning & Roll Execution</span>
            </div>
            <span className="badge badge-info">Fast Tactile Pad</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {t.poNumber}
              </label>
              <select
                id="select-cutting-po"
                className="console-input"
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
              >
                {orders.map((o) => (
                  <option key={o.po_number} value={o.po_number}>
                    {o.po_number} — {o.style_name} ({o.order_qty} pcs)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                {t.fabricRoll}
              </label>
              <select
                id="select-cutting-roll"
                className="console-input"
                value={selectedRoll}
                onChange={(e) => setSelectedRoll(e.target.value)}
              >
                {rolls.map((r) => (
                  <option key={r.roll_barcode} value={r.roll_barcode}>
                    {r.roll_barcode} — {r.fabric_type} ({r.remaining_length_meters}m left)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {t.metersConsumed}
            </label>
            <input
              type="number"
              id="input-cutting-meters"
              className="console-input"
              value={fabricIssued}
              onChange={(e) => setFabricIssued(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Size Breakdown Matrix */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t.sizeBreakdown}
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }} className="tabular-num">
                Total: {totalCalculatedPieces} pcs
              </span>
            </div>

            <div className="size-grid">
              {Object.keys(sizeInputs).map((sizeKey) => (
                <div key={sizeKey} className="size-input-cell">
                  <div className="size-label-tag">Size {sizeKey}</div>
                  <input
                    type="number"
                    id={`input-size-${sizeKey}`}
                    value={sizeInputs[sizeKey]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setSizeInputs((prev) => ({ ...prev, [sizeKey]: val }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live Automated Analytics Badges */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Automated Backend Intelligence (Zero Manual Math)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Calculated Scrap</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#f59e0b' }} className="tabular-num">
                  {calculatedWaste}m ({calculatedWastePct}%)
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Roll Remaining</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: rollBalanceAfterCut < 0 ? '#ef4444' : '#10b981' }} className="tabular-num">
                  {rollBalanceAfterCut}m
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cutting Efficiency</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8' }} className="tabular-num">{efficiency}%</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Allowed Max (105%)</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#a78bfa' }} className="tabular-num">
                  {selectedOrderObj ? Math.round(selectedOrderObj.order_qty * 1.05).toLocaleString() : 'N/A'} pcs
                </div>
              </div>
            </div>

            {selectedOrderObj && totalCalculatedPieces > Math.round(selectedOrderObj.order_qty * 1.05) && (
              <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '12px', color: '#f87171', fontWeight: 600 }}>
                ⚠️ 5% CUTTING EXCESS EXCEEDED: Entry will be logged under EXCESS_EXCEPTION and sent to General Manager for mandatory approval.
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-submit-cutting-direct"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            onClick={handleManualSubmit}
            disabled={totalCalculatedPieces <= 0 || rollBalanceAfterCut < 0}
          >
            <CheckCircle2 size={16} />
            <span>Commit Cutting Entry</span>
          </button>
        </div>
      )}

      {/* TAB 4: CUTTING HISTORY & INTERACTIVE ANALYTICS */}
      {activeTab === 'HISTORY' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="card-title">
              <Clock size={17} color="#f59e0b" />
              <span>Cutting Production Records & Analytics</span>
            </div>

            {/* Timeframe Filter Buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['ALL', 'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`btn btn-sm ${historyFilter === filterKey ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => setHistoryFilter(filterKey)}
                >
                  {filterKey.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Filtered Records */}
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Entry Code</th>
                  <th>PO Number</th>
                  <th>Style</th>
                  <th>Fabric</th>
                  <th>Roll Barcode</th>
                  <th>Cut Pieces</th>
                  <th>Waste (Meters)</th>
                  <th>Efficiency</th>
                  <th>Lock Expiration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No cutting records match the selected timeframe ({historyFilter}).
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => {
                    const isLocked = entry.lockStatus?.isLocked;
                    const minsLeft = entry.lockStatus?.minutesRemaining || 0;

                    return (
                      <tr key={entry.id}>
                        <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                          {entry.entry_code}
                        </td>
                        <td style={{ fontWeight: 600 }}>{entry.po_number}</td>
                        <td>{entry.style_name}</td>
                        <td style={{ color: '#94a3b8' }}>{entry.fabric_type || 'Denim'}</td>
                        <td className="mono">{entry.roll_barcode}</td>
                        <td style={{ fontWeight: 700 }} className="tabular-num">{entry.total_pieces_cut} pcs</td>
                        <td>
                          <span style={{ color: entry.waste_percentage > 5 ? '#f87171' : '#fbbf24' }}>
                            {entry.waste_meters}m ({entry.waste_percentage}%)
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {entry.fabric_issued_meters > 0
                              ? Math.round(((entry.total_pieces_cut * 1.35) / entry.fabric_issued_meters) * 100)
                              : 100}
                            %
                          </span>
                        </td>
                        <td>
                          {isLocked ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Locked at {entry.lock_at?.substring(11, 16)}</span>
                          ) : (
                            <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '12px' }}>
                              {minsLeft}m remaining
                            </span>
                          )}
                        </td>
                        <td>
                          {entry.status === 'EXCESS_EXCEPTION' ? (
                            <span className="badge badge-danger">EXCESS EXCEPTION</span>
                          ) : isLocked ? (
                            <span className="badge badge-locked">
                              <ShieldAlert size={12} />
                              <span>LOCKED</span>
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              <Clock size={12} />
                              <span>EDITABLE (1h)</span>
                            </span>
                          )}
                        </td>
                        <td>
                          {!isLocked && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEdit(entry)}
                              title="Edit within 1-hour grace window"
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1-Hour Grace Window Edit Modal */}
      {editingEntry && (
        <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="#0284c7" />
                <span>Correct Entry #{editingEntry.entry_code}</span>
              </h3>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Entries can be corrected within 60 minutes. Changes require a mandatory justification reason and are permanently recorded in the audit trail.
            </div>

            {editError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px', color: '#f87171', fontSize: '12.5px', marginBottom: '14px' }}>
                {editError}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Corrected Total Pieces Cut (Old: {editingEntry.total_pieces_cut} pcs)
              </label>
              <input
                type="number"
                className="console-input"
                value={editPieces}
                onChange={(e) => setEditPieces(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Corrected Waste Meters (Old: {editingEntry.waste_meters}m)
              </label>
              <input
                type="number"
                className="console-input"
                value={editWaste}
                onChange={(e) => setEditWaste(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#f59e0b' }}>
                Mandatory Reason for Correction (Audit Requirement)
              </label>
              <textarea
                className="console-input"
                style={{ minHeight: '70px' }}
                placeholder="Explain why this correction is being made..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingEntry(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveCorrection}>
                Save Correction & Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
