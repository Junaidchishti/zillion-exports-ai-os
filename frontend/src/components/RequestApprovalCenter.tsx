import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, QrCode, Clock, RefreshCw, Send, AlertTriangle, MessageSquare, Printer } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';
import confetti from 'canvas-confetti';

export const RequestApprovalCenter: React.FC = () => {
  const { language, user } = useAuth();
  const t = translations[language];

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [reviewComments, setReviewComments] = useState<string>('');
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const isExecutive = user?.roleCode === 'CEO' || user?.roleCode === 'GENERAL_MANAGER';

  const loadPending = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getPendingApprovals();
      setPendingRequests(data);
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadPending();
  }, [user]);

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest || isProcessing) return;
    setIsProcessing(true);
    setActionError('');

    try {
      const res = await api.reviewApproval(selectedRequest.id, decision, reviewComments);

      if (decision === 'APPROVED') {
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
        } catch (e) {
          // ignore
        }
        if (res.qrToken) {
          setGeneratedQR(res.qrToken);
        }
      }

      await loadPending();
      if (decision === 'REJECTED') {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to review request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb & Hierarchy Banner */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Governance:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">Executive Authority</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">Multi-Tier Approval & Handover Engine</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node" style={{ color: '#94a3b8' }}>
          Authorized Approver: {user?.fullName} ({user?.roleCode})
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            <ShieldCheck className="text-cyan" size={24} color="#0284c7" />
            <span>Executive Request & Approval Portal</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            {language === 'ur'
              ? 'شعبہ جاتی مٹیریل کی ترسیل، سلائی ہینڈ اوور اور ترمیمات کی باضابطہ منظوری'
              : 'Multi-tier authorization engine for material allocation, inter-department transfers & cryptographic QR generation'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadPending}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {!isExecutive && (
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle color="#f59e0b" size={18} />
          <span style={{ fontSize: '12.5px', color: '#fbbf24' }}>
            You are viewing this portal in read-only mode as <strong>{user?.fullName} ({user?.roleCode})</strong>. Authorization actions require CEO or General Manager credentials.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(360px, 1.2fr)', gap: '20px' }}>
        {/* Pending Requests Queue */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Clock size={17} color="#f59e0b" />
              <span>Pending Authorization Queue</span>
            </div>
            <span className="badge badge-warning">{pendingRequests.length} Pending</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRequests.length === 0 ? (
              <div className="empty-state-box">
                <CheckCircle2 size={32} color="#10b981" />
                <h4>Inbox Zero</h4>
                <p>All transfer requests and material allocations have been reviewed and authorized.</p>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => {
                    setSelectedRequest(req);
                    setGeneratedQR(null);
                    setActionError('');
                  }}
                  style={{
                    backgroundColor: selectedRequest?.id === req.id ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
                    border: `1px solid ${selectedRequest?.id === req.id ? '#0284c7' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {req.request_number}
                    </span>
                    <span className={`badge ${req.request_type.includes('EXCESS') ? 'badge-danger' : 'badge-warning'}`}>
                      {req.request_type.includes('EXCESS') ? 'EXCESS OVERRIDE' : 'TRANSFER'}
                    </span>
                  </div>

                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
                    {req.quantity?.toLocaleString()} pcs from {req.from_dept} → {req.to_dept}
                  </div>

                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Target PO: <strong>{req.po_number}</strong></span>
                    <span>{req.created_at?.substring(0, 16)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Request Review & Decision Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <QrCode size={17} color="#0284c7" />
              <span>Inspection & Authorization Details</span>
            </div>
            {selectedRequest && <span className="badge badge-info">{selectedRequest.request_number}</span>}
          </div>

          {selectedRequest ? (
            <div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Request ID</div>
                    <div className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{selectedRequest.request_number}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target PO</div>
                    <div style={{ fontWeight: 700 }}>{selectedRequest.po_number}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Movement Route</div>
                    <div style={{ fontWeight: 600, color: '#10b981' }}>{selectedRequest.from_dept} ➔ {selectedRequest.to_dept}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Authorized Quantity</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }} className="tabular-num">{selectedRequest.quantity?.toLocaleString()} pcs</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Initiated By</div>
                    <div>{selectedRequest.requester_name || selectedRequest.from_dept} (Timestamp: {selectedRequest.created_at})</div>
                  </div>
                </div>
              </div>

              {actionError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px', color: '#f87171', fontSize: '12.5px', marginBottom: '16px' }}>
                  {actionError}
                </div>
              )}

              {/* Generated QR Code on Approval */}
              {generatedQR ? (
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid #10b981', marginBottom: '16px' }}>
                  <div style={{ display: 'inline-flex', padding: '16px', backgroundColor: '#090d16', borderRadius: '12px', color: '#38bdf8', marginBottom: '12px' }}>
                    <QrCode size={110} />
                  </div>
                  <div className="mono" style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    {generatedQR}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Authorized & Encrypted Handover Token. Scan at receiving department to complete intake.
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '14px' }}
                    onClick={() => window.print()}
                  >
                    <Printer size={14} />
                    <span>Print Bundle QR Label</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Executive Approval Rationale / Instructions (Mandatory for Audit Trail)
                    </label>
                    <textarea
                      className="console-input"
                      style={{ minHeight: '75px' }}
                      placeholder="Enter executive review note or instructions for receiving master..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      id="btn-approve-request"
                      className="btn btn-success"
                      style={{ flex: 1 }}
                      onClick={() => handleReview('APPROVED')}
                      disabled={!isExecutive || isProcessing}
                    >
                      <CheckCircle2 size={16} />
                      <span>{language === 'ur' ? 'منظور کریں اور QR بنائیں' : 'Authorize & Generate QR'}</span>
                    </button>

                    <button
                      type="button"
                      id="btn-reject-request"
                      className="btn btn-danger"
                      onClick={() => handleReview('REJECTED')}
                      disabled={!isExecutive || isProcessing}
                    >
                      <XCircle size={16} />
                      <span>{t.reject}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state-box">
              <ShieldCheck size={32} color="#0284c7" />
              <h4>Select Request to Authorize</h4>
              <p>Choose an allocation request from the left queue to inspect quantities, route path, and issue cryptographically verifiable QR tokens.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
