import React, { useState, useEffect } from 'react';
import {
  Send,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  Sparkles,
  RefreshCw,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import { AgentChatConsole } from './AgentChatConsole.js';

interface RequestCreationPortalProps {
  department?: string;
  onOpenQRScanner?: () => void;
}

export const RequestCreationPortal: React.FC<RequestCreationPortalProps> = ({
  department,
  onOpenQRScanner,
}) => {
  const { language, user } = useAuth();
  const t = translations[language];

  const currentDept = department || user?.departmentCode || 'CUTTING';
  const [activeTab, setActiveTab] = useState<'CREATE' | 'MY_REQUESTS'>('MY_REQUESTS');
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Structured Request Form State
  const [requestType, setRequestType] = useState<string>('MATERIAL_ISSUE');
  const [selectedPO, setSelectedPO] = useState<string>('PO-452');
  const [toDepartment, setToDepartment] = useState<string>('STORE');
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState<string>('pcs');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [requiredDate, setRequiredDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [reason, setReason] = useState<string>('');

  // Structured Confirmation Review State
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Selected QR preview modal
  const [selectedQRToken, setSelectedQRToken] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [reqs, ords] = await Promise.all([
        api.getMyRequests(),
        api.getOrders(),
      ]);
      setMyRequests(reqs);
      setOrders(ords);
    } catch (err) {
      console.error('Failed to load my requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadRequests();
  }, [user, currentDept]);

  const handleOpenReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setSubmitError('A specific operational reason is required for compliance.');
      return;
    }
    setSubmitError(null);
    setShowReviewModal(true);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const orderObj = orders.find((o) => o.po_number === selectedPO);
      await api.createAllocationRequest({
        requestType,
        fromDept: currentDept,
        toDept: toDepartment,
        poNumber: selectedPO,
        quantity,
        styleId: orderObj?.style_id,
        colorId: orderObj?.color_id,
        priority,
        requiredDate,
        reason,
        payloadDetails: {
          unit,
          requesterName: user?.fullName || user?.username,
          requesterRole: user?.roleCode,
        },
      });

      setShowReviewModal(false);
      setReason('');
      setSubmitSuccess(`Request successfully submitted for PO ${selectedPO}. Assigned to General Manager / CEO.`);
      await loadRequests();
      setActiveTab('MY_REQUESTS');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = myRequests.filter(
    (r) =>
      r.request_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.po_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.request_type?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.status?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Workstation:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">{currentDept} Department</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">Request Creation & Tracking Portal</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node" style={{ color: '#94a3b8' }}>
          User: {user?.fullName} ({user?.roleCode})
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            <Send className="text-cyan" size={24} color="#0284c7" />
            <span>{currentDept} Request & Allocation Portal</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            Submit formal material, trim, batch, or handover requests and track multi-tier management approvals in real-time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setActiveTab('CREATE')}
          >
            <Plus size={14} />
            <span>Create New Request</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadRequests}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Sync Requests</span>
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', padding: '12px 16px', color: '#10b981', fontSize: '13px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{submitSuccess}</span>
          <button type="button" className="btn-icon" onClick={() => setSubmitSuccess(null)}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-item ${activeTab === 'MY_REQUESTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('MY_REQUESTS')}
        >
          <Clock size={15} />
          <span>My Submitted Requests ({myRequests.length})</span>
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'CREATE' ? 'active' : ''}`}
          onClick={() => setActiveTab('CREATE')}
        >
          <Plus size={15} />
          <span>Create New Request (Form & Voice)</span>
        </button>
      </div>

      {/* TAB 1: MY REQUESTS TRACKER */}
      {activeTab === 'MY_REQUESTS' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileText size={17} color="#0284c7" />
              <span>Department Request Tracking Ledger</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <input
                  type="text"
                  className="console-input"
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '12px' }}
                  placeholder="Filter requests by PO or code..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              </div>
              <span className="badge badge-info">{filteredRequests.length} Records</span>
            </div>
          </div>

          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Type & Route</th>
                  <th>Target PO</th>
                  <th>Quantity</th>
                  <th>Date / Time</th>
                  <th>Status</th>
                  <th>Approver / Notes</th>
                  <th>Action / QR</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No requests recorded yet. Click "Create New Request" above to initiate a material or handover request.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                        {req.request_number}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{req.request_type}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {req.from_dept} ➔ {req.to_dept}
                        </div>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>{req.po_number}</td>
                      <td style={{ fontWeight: 700 }} className="tabular-num">{req.quantity?.toLocaleString()}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {req.created_at?.substring(0, 16)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            req.status === 'APPROVED'
                              ? 'badge-success'
                              : req.status === 'REJECTED'
                              ? 'badge-danger'
                              : req.status === 'FULFILLED'
                              ? 'badge-info'
                              : 'badge-warning'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {req.rejection_reason || req.payload_details || 'Pending executive review'}
                      </td>
                      <td>
                        {req.qr_token || req.status === 'APPROVED' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => setSelectedQRToken(req.qr_token || `ZX-ALL-${req.po_number}-${req.id}`)}
                          >
                            <QrCode size={13} />
                            <span>View QR</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Awaiting</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE NEW REQUEST */}
      {activeTab === 'CREATE' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(340px, 1fr)', gap: '20px' }}>
          {/* Left Column: Direct Structured Form */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Plus size={17} color="#0284c7" />
                <span>Standard Request Dispatch Form</span>
              </div>
              <span className="badge badge-info">{currentDept} Initiator</span>
            </div>

            <form onSubmit={handleOpenReview}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Request Category / Type
                </label>
                <select
                  className="console-input"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                >
                  <option value="MATERIAL_ISSUE">Material & Fabric Issue</option>
                  <option value="ACCESSORY_REQUEST">Thread, Trims & Accessories Request</option>
                  <option value="CUTTING_TO_STITCHING">Handover Cut Pieces to Stitching (CMT)</option>
                  <option value="STITCHING_TO_WASHING">Handover Stitched Lot to Washing</option>
                  <option value="WASHING_TO_FINISHING">Handover Washed Garments to Finishing</option>
                  <option value="FINISHING_TO_PACKING">Handover Finished Garments to Packing</option>
                  <option value="REWORK_REQUEST">Quality Rework / Alteration Request</option>
                  <option value="DISPATCH_REQUEST">Container Export Dispatch Authorization</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Target PO Number
                  </label>
                  <select
                    className="console-input"
                    value={selectedPO}
                    onChange={(e) => setSelectedPO(e.target.value)}
                  >
                    {orders.map((o) => (
                      <option key={o.po_number} value={o.po_number}>
                        {o.po_number} — {o.style_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Destination Department
                  </label>
                  <select
                    className="console-input"
                    value={toDepartment}
                    onChange={(e) => setToDepartment(e.target.value)}
                  >
                    <option value="STORE">STORE</option>
                    <option value="CUTTING">CUTTING</option>
                    <option value="STITCHING">STITCHING</option>
                    <option value="WASHING">WASHING</option>
                    <option value="FINISHING">FINISHING</option>
                    <option value="QUALITY">QUALITY (QC)</option>
                    <option value="PACKING">PACKING</option>
                    <option value="SHIPMENT">SHIPMENT</option>
                    <option value="GENERAL_MANAGER">GENERAL MANAGER</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="console-input"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <select
                    className="console-input"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="rolls">Rolls</option>
                    <option value="meters">Meters</option>
                    <option value="cones">Thread Cones</option>
                    <option value="cartons">Cartons</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    className="console-input"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent / Line Block</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Operational Reason & Detailed Justification (Mandatory)
                </label>
                <textarea
                  className="console-input"
                  style={{ minHeight: '80px' }}
                  placeholder="Explain why this material or handover allocation is required..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              {submitError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px', color: '#f87171', fontSize: '12.5px', marginBottom: '14px' }}>
                  {submitError}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '11px' }}>
                <Send size={15} />
                <span>Review & Submit Request</span>
              </button>
            </form>
          </div>

          {/* Right Column: AI Assistant for Voice & Natural Text Requests */}
          <div>
            <AgentChatConsole
              department={currentDept}
              title={`${currentDept} AI Request Assistant (Voice & Text)`}
              onActionCommitted={loadRequests}
            />
          </div>
        </div>
      )}

      {/* Structured Confirmation Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#0284c7" />
                <span>Structured Request Review</span>
              </h3>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Please verify the parameters before committing this request to the central operating system.
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Request Type</div>
                  <div style={{ fontWeight: 700, color: '#38bdf8' }}>{requestType}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target PO</div>
                  <div style={{ fontWeight: 700 }}>{selectedPO}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Route Path</div>
                  <div style={{ fontWeight: 600, color: '#10b981' }}>{currentDept} ➔ {toDepartment}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Quantity</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{quantity} {unit}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Priority</div>
                  <div>
                    <span className={`badge ${priority === 'URGENT' ? 'badge-danger' : priority === 'HIGH' ? 'badge-warning' : 'badge-info'}`}>
                      {priority}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Requester</div>
                  <div>{user?.fullName} ({user?.roleCode})</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Operational Rationale</div>
                  <div style={{ fontStyle: 'italic', marginTop: '2px' }}>"{reason}"</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
              >
                Edit Parameters
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleFinalSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Confirm & Commit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Preview Modal */}
      {selectedQRToken && (
        <div className="modal-overlay" onClick={() => setSelectedQRToken(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={18} color="#0284c7" />
                <span>Authorized Handover Token</span>
              </h3>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#090d16', borderRadius: '12px', display: 'inline-flex', margin: '14px 0', color: '#38bdf8' }}>
              <QrCode size={130} />
            </div>

            <div className="mono" style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              {selectedQRToken}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Scan this token at the receiving department terminal to verify authorization and log material movement.
            </p>

            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedQRToken(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
