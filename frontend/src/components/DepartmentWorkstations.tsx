import React, { useState, useEffect } from 'react';
import {
  Package,
  Activity,
  Droplets,
  Sparkles,
  CheckSquare,
  Box,
  Truck,
  DollarSign,
  AlertTriangle,
  Layers,
  RefreshCw,
  Plus,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  Search,
  Filter,
  Eye,
  Sliders,
  Check,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import { AgentChatConsole } from './AgentChatConsole.js';
import { OrderIntakeModal } from './OrderIntakeModal.js';

interface DepartmentWorkstationProps {
  department:
    | 'STORE'
    | 'STITCHING'
    | 'WASHING'
    | 'FINISHING'
    | 'QUALITY'
    | 'PACKING'
    | 'SHIPMENT'
    | 'FINANCE'
    | 'MERCHANDISING'
    | 'PROCUREMENT';
}

export const DepartmentWorkstation: React.FC<DepartmentWorkstationProps> = ({ department }) => {
  const { language, user } = useAuth();
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SMART_ENTRY' | 'HANDOVERS' | 'LEDGER'>('OVERVIEW');
  const [orders, setOrders] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any | null>(null);
  const [rolls, setRolls] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOrderIntakeOpen, setIsOrderIntakeOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Store check-in modal
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [newRollBarcode, setNewRollBarcode] = useState<string>(`ROLL-${Date.now().toString().substring(7)}`);
  const [newRollFabric, setNewRollFabric] = useState<string>('12oz Indigo Ring Denim (NDM-12)');
  const [newRollMeters, setNewRollMeters] = useState<number>(1500);
  const [newRollShade, setNewRollShade] = useState<string>('Dark Indigo');
  const [newRollLot, setNewRollLot] = useState<string>('LOT-2026-A');
  const [newRollLocation, setNewRollLocation] = useState<string>('RACK-A1');

  const loadDeptData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (department === 'STORE') {
        const [rData, accData, txData] = await Promise.all([
          api.getFabricRolls(),
          api.getAccessories(),
          api.getStoreTransactions(),
        ]);
        setRolls(rData);
        setAccessories(accData);
        setTransactions(txData);
      } else if (department === 'FINANCE') {
        const fData = await api.getFinanceSummary();
        setFinanceData(fData);
      }
      const [ords, apprs] = await Promise.all([
        api.getOrders(),
        api.getPendingApprovals(),
      ]);
      setOrders(ords);
      setPendingApprovals(apprs);
    } catch (err) {
      console.error('Failed to load dept data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDeptData();
  }, [department, user]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.checkInFabricRoll({
        rollBarcode: newRollBarcode,
        supplierId: 2,
        fabricType: newRollFabric,
        shadeColor: newRollShade,
        lotBatchNumber: newRollLot,
        originalLengthMeters: newRollMeters,
        warehouseLocation: newRollLocation,
      });
      setShowCheckInModal(false);
      setNewRollBarcode(`ROLL-${Date.now().toString().substring(7)}`);
      await loadDeptData();
    } catch (err: any) {
      alert(`Check-in error: ${err.message}`);
    }
  };

  const getDeptIcon = () => {
    switch (department) {
      case 'STORE': return <Package size={22} color="#0284c7" />;
      case 'STITCHING': return <Activity size={22} color="#10b981" />;
      case 'WASHING': return <Droplets size={22} color="#06b6d4" />;
      case 'FINISHING': return <Sparkles size={22} color="#a855f7" />;
      case 'QUALITY': return <CheckSquare size={22} color="#f59e0b" />;
      case 'PACKING': return <Box size={22} color="#f97316" />;
      case 'SHIPMENT': return <Truck size={22} color="#3b82f6" />;
      case 'FINANCE': return <DollarSign size={22} color="#10b981" />;
      case 'MERCHANDISING': return <Mail size={22} color="#0284c7" />;
      case 'PROCUREMENT': return <Package size={22} color="#fbbf24" />;
    }
  };

  const deptPending = pendingApprovals.filter(
    (a) => a.from_department === department || a.to_department === department
  );

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb & Hierarchy Banner */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Hierarchy:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">Manufacturing Floor</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">{department} Workstation</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node" style={{ color: '#94a3b8' }}>
          User: {user?.fullName || user?.username} ({user?.roleCode})
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            {getDeptIcon()}
            <span>{department} Department Workstation</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            {language === 'ur'
              ? 'وائس اور ٹیکسٹ اسسٹنٹ، سمارٹ کلاسیفکیشن، 1 گھنٹے کی گریس ونڈو، اور خودکار لیجر'
              : 'Voice & text AI assistant, strict order traceability, 1-hour grace window, and verified handovers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {department === 'MERCHANDISING' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsOrderIntakeOpen(true)}>
              <Mail size={14} />
              <span>Email Order Intake</span>
            </button>
          )}
          {department === 'STORE' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCheckInModal(true)}>
              <Plus size={14} />
              <span>Check-in Fabric Roll</span>
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDeptData}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-item ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
          onClick={() => setActiveTab('OVERVIEW')}
        >
          <Layers size={15} />
          <span>Operational Overview</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'SMART_ENTRY' ? 'active' : ''}`}
          onClick={() => setActiveTab('SMART_ENTRY')}
        >
          <Sparkles size={15} />
          <span>Smart AI Entry (Voice & Text)</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'HANDOVERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('HANDOVERS')}
        >
          <Send size={15} />
          <span>Department Handovers ({deptPending.length})</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'LEDGER' ? 'active' : ''}`}
          onClick={() => setActiveTab('LEDGER')}
        >
          <Clock size={15} />
          <span>Department Ledger & Rolls</span>
        </button>
      </div>

      {/* TAB 1: OPERATIONAL OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div>
          {/* Quality specific alert banner */}
          {department === 'QUALITY' && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <AlertTriangle size={20} color="#ef4444" style={{ marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#f87171' }}>
                  QC Packing Hold Protocol Active
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Logging critical defects exceeding the AQL 2.5 threshold automatically triggers a <strong>PACKING HOLD</strong> on the target PO, immediately notifying the General Manager and blocking the Packing Master from boxing garments.
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Layers size={17} color="#0284c7" />
                <span>Active Production Orders in {department} Pipeline</span>
              </div>
              <span className="badge badge-info">{orders.length} Active POs</span>
            </div>

            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Customer</th>
                    <th>Style & Color</th>
                    <th>Order Quantity</th>
                    <th>Target Delivery</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{o.po_number}</td>
                      <td>{o.customer_name}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.style_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.color_name}</div>
                      </td>
                      <td style={{ fontWeight: 700 }} className="tabular-num">{o.order_qty.toLocaleString()} pcs</td>
                      <td>{o.target_delivery_date}</td>
                      <td>
                        <span className={`badge ${o.status === 'APPROVED' ? 'badge-success' : 'badge-info'}`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SMART AI ENTRY */}
      {activeTab === 'SMART_ENTRY' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(340px, 1fr)', gap: '20px' }}>
          <div>
            <AgentChatConsole
              department={department}
              title={`${department} Assistant (Voice & Text)`}
              onActionCommitted={loadDeptData}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Sparkles size={17} color="#0284c7" />
                <span>Voice Guidance & Entry Rules</span>
              </div>
              <span className="badge badge-success">Zero Manual Math</span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '12px' }}>
                You can record entries in <strong>English</strong> or <strong>اردو (Urdu)</strong> via voice or text. The system automatically matches parameters against active factory orders.
              </p>
              
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px' }}>
                  Example Voice / Text Inputs:
                </div>
                <div className="mono" style={{ fontSize: '12px', color: '#f8fafc' }}>
                  • "PO 452, processed 1000 pieces on Line 1"<br />
                  • "PO 452، Stone Wash بیچ 990 پیس مکمل کیے"<br />
                  • "PO 780, loaded 2000 pieces in container MSCU-8812"
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px' }}>
                <CheckCircle2 size={16} />
                <span>Structured Confirmation is always displayed prior to committing any entry.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENDING HANDOVERS & ALLOCATIONS */}
      {activeTab === 'HANDOVERS' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Send size={17} color="#0284c7" />
              <span>Department Handovers & Transfer Requests</span>
            </div>
            <span className="badge badge-info">{deptPending.length} Requests</span>
          </div>

          {deptPending.length === 0 ? (
            <div className="empty-state-box">
              <CheckCircle2 size={32} color="#10b981" />
              <h4>No Pending Handovers</h4>
              <p>All transfer requests for the {department} department are processed and up to date.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Request Code</th>
                    <th>Type</th>
                    <th>PO Number</th>
                    <th>Route</th>
                    <th>Quantity</th>
                    <th>Requested By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deptPending.map((req) => (
                    <tr key={req.id}>
                      <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{req.request_number}</td>
                      <td>{req.request_type}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{req.po_number}</td>
                      <td>
                        <span className="mono">{req.from_department}</span> → <span className="mono">{req.to_department}</span>
                      </td>
                      <td style={{ fontWeight: 700 }} className="tabular-num">{req.quantity?.toLocaleString()} pcs</td>
                      <td>{req.requested_by_name || 'Master ID #' + req.requested_by}</td>
                      <td>
                        <span className="badge badge-warning">{req.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEPARTMENT LEDGER & STORE ROLLS */}
      {activeTab === 'LEDGER' && (
        <div>
          {department === 'STORE' ? (
            <div>
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header">
                  <div className="card-title">
                    <Package size={17} color="#0284c7" />
                    <span>Fabric Rolls in Store (Tracked Individually by ROLL)</span>
                  </div>
                  <span className="badge badge-success">{rolls.length} Active Rolls</span>
                </div>

                <div className="table-container">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Roll Barcode</th>
                        <th>Fabric Type</th>
                        <th>Shade Color</th>
                        <th>Lot / Batch</th>
                        <th>Original</th>
                        <th>Remaining</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolls.map((r) => (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{r.roll_barcode}</td>
                          <td>{r.fabric_type}</td>
                          <td>{r.shade_color}</td>
                          <td className="mono">{r.lot_batch_number}</td>
                          <td className="tabular-num">{r.original_length_meters}m</td>
                          <td className="tabular-num" style={{ fontWeight: 700, color: r.remaining_length_meters < 100 ? '#f59e0b' : '#10b981' }}>
                            {r.remaining_length_meters}m
                          </td>
                          <td>
                            <span className="badge badge-info">{r.warehouse_location}</span>
                          </td>
                          <td>
                            <span className={`badge ${r.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accessories Stock Matrix */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <Box size={17} color="#0284c7" />
                    <span>Trim & Accessories Warehouse Stock</span>
                  </div>
                  <span className="badge badge-info">{accessories.length} Items</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {accessories.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{a.item_type}</div>
                      <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>{a.name}</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }} className="tabular-num">
                        {a.current_stock?.toLocaleString()} {a.unit}
                      </div>
                      <div style={{ fontSize: '11.5px', color: a.current_stock < (a.reorder_level || 500) ? '#f87171' : 'var(--text-muted)', marginTop: '4px' }}>
                        Min Threshold: {a.reorder_level || 500} {a.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Clock size={17} color="#f59e0b" />
                  <span>{department} Audit History & 1-Hour Lock Timeline</span>
                </div>
                <span className="badge badge-warning">Immutable Audit Active</span>
              </div>

              <div className="empty-state-box" style={{ padding: '32px' }}>
                <ShieldCheck size={32} color="#10b981" />
                <h4>Production History Synchronized</h4>
                <p>All transactions in {department} are locked after the 1-hour grace period with mandatory before/after diff audit logging.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Order Intake Modal */}
      {isOrderIntakeOpen && (
        <OrderIntakeModal
          isOpen={isOrderIntakeOpen}
          onClose={() => setIsOrderIntakeOpen(false)}
          onOrderCreated={loadDeptData}
        />
      )}

      {/* Store Check-In Modal */}
      {showCheckInModal && (
        <div className="modal-overlay" onClick={() => setShowCheckInModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} color="#0284c7" />
                <span>Check-in New Fabric Roll</span>
              </h3>
            </div>

            <form onSubmit={handleCheckInSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Roll Barcode
                </label>
                <input
                  type="text"
                  className="console-input"
                  value={newRollBarcode}
                  onChange={(e) => setNewRollBarcode(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Fabric Type & Spec
                </label>
                <input
                  type="text"
                  className="console-input"
                  value={newRollFabric}
                  onChange={(e) => setNewRollFabric(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Shade Color
                  </label>
                  <input
                    type="text"
                    className="console-input"
                    value={newRollShade}
                    onChange={(e) => setNewRollShade(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Lot / Batch Number
                  </label>
                  <input
                    type="text"
                    className="console-input"
                    value={newRollLot}
                    onChange={(e) => setNewRollLot(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Length (Meters)
                  </label>
                  <input
                    type="number"
                    className="console-input"
                    value={newRollMeters}
                    onChange={(e) => setNewRollMeters(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Warehouse Rack Location
                  </label>
                  <input
                    type="text"
                    className="console-input"
                    value={newRollLocation}
                    onChange={(e) => setNewRollLocation(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>Commit Roll to Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
