import React, { useState } from 'react';
import { Mail, CheckCircle2, ShieldCheck, ArrowRight, FileText, X } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import confetti from 'canvas-confetti';

interface OrderIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
}

export const OrderIntakeModal: React.FC<OrderIntakeModalProps> = ({ isOpen, onClose, onOrderCreated }) => {
  const { user } = useAuth();
  const [emailSubject, setEmailSubject] = useState<string>("Official PO #589 - 6,000 Units Men's Slim Denim Jeans (Levi Strauss)");
  const [emailBody, setEmailBody] = useState<string>(
    `Dear Zillion Exports Team,\n\nPlease process Purchase Order PO-589 for 6,000 units of Style J-801 (Men's Slim Fit 12oz Denim Jeans in Dark Indigo Blue).\nUnit Price agreed: $16.50 / piece.\nTarget Delivery Date: 2026-11-30.\n\nSize Breakdown:\nSize 28: 600 pcs\nSize 30: 1500 pcs\nSize 32: 2100 pcs\nSize 34: 1200 pcs\nSize 36: 600 pcs\n\nSpecifications: 12oz Indigo Ring Denim, YKK Brass 5# Zipper, Gunmetal Rivets.\n\nRegards,\nMarkus Vance\nLevi Strauss Europe`
  );

  const [extractedBOM, setExtractedBOM] = useState<any | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleParseEmail = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const data = await api.parseEmailOrder(emailSubject, emailBody);
      setExtractedBOM(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extract BOM from email text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!extractedBOM) return;
    setIsProcessing(true);
    try {
      const order = await api.submitOrderDraft(extractedBOM);
      setCreatedOrder(order);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit order draft.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMerchApprove = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);
    try {
      const updated = await api.approveOrderMerchandiser(createdOrder.id);
      setCreatedOrder(updated);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCeoApprove = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);
    try {
      const updated = await api.approveOrderCEO(createdOrder.id);
      setCreatedOrder(updated);
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
      } catch (e) {
        // ignore
      }
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail size={22} color="#06b6d4" />
            <span>Customer Email Order Intake & Dual-Approval Pipeline</span>
          </h3>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px', color: '#f87171', fontSize: '13px', marginBottom: '14px' }}>
            {errorMsg}
          </div>
        )}

        {/* Step 1: Raw Email Input */}
        {!extractedBOM && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Email Subject</label>
              <input type="text" className="console-input" style={{ width: '100%' }} value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Incoming Customer Email Body</label>
              <textarea className="console-input" style={{ width: '100%', minHeight: '180px', fontFamily: 'var(--font-mono)', fontSize: '13px' }} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
            </div>

            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleParseEmail} disabled={isProcessing}>
              <FileText size={16} />
              <span>Parse & Extract Structured Order BOM</span>
            </button>
          </div>
        )}

        {/* Step 2: Extracted Structured BOM Review & Approval Stages */}
        {extractedBOM && (
          <div>
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="mono" style={{ fontWeight: 800, fontSize: '16px', color: '#38bdf8' }}>{extractedBOM.poNumber}</span>
                <span className={`badge ${createdOrder?.status === 'APPROVED' ? 'badge-success' : createdOrder?.status === 'PENDING_APPROVAL' ? 'badge-info' : 'badge-warning'}`}>
                  STATUS: {createdOrder?.status || 'EXTRACTED_DRAFT'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '13px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Style: </span><strong>{extractedBOM.styleCode}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Volume: </span><strong>{extractedBOM.totalQuantity.toLocaleString()} pcs</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Price: </span><strong>${extractedBOM.unitPrice.toFixed(2)}/pc</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Delivery: </span><strong>{extractedBOM.deliveryDate}</strong></div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fabric Spec: </span>
                  <span style={{ fontSize: '12px' }}>{extractedBOM.fabricSpec}</span>
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Extracted Size Breakdown:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {Object.entries(extractedBOM.sizeBreakdown).map(([size, qty]: any) => (
                    <span key={size} className="badge badge-info">
                      Size {size}: {qty} pcs
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Dual Approval Workflow Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!createdOrder && (
                <button type="button" className="btn btn-primary" onClick={handleSubmitDraft} disabled={isProcessing}>
                  <ArrowRight size={16} />
                  <span>Submit Order Draft to Merchandiser Review Queue</span>
                </button>
              )}

              {createdOrder && createdOrder.status === 'DRAFT' && (
                <button type="button" className="btn btn-primary" onClick={handleMerchApprove} disabled={isProcessing}>
                  <CheckCircle2 size={16} />
                  <span>Merchandising Officer Sign-Off & Verify BOM</span>
                </button>
              )}

              {createdOrder && createdOrder.status === 'PENDING_APPROVAL' && (
                <button type="button" className="btn btn-success" onClick={handleCeoApprove} disabled={isProcessing}>
                  <ShieldCheck size={18} />
                  <span>CEO Final Approval (Release into Production)</span>
                </button>
              )}

              {createdOrder && createdOrder.status === 'APPROVED' && (
                <div style={{ textAlign: 'center', color: '#10b981', fontWeight: 700, padding: '10px' }}>
                  ✅ Order successfully released into factory production! Store & Cutting notified.
                </div>
              )}

              <button type="button" className="btn btn-secondary" onClick={() => { setExtractedBOM(null); setCreatedOrder(null); }}>
                Reset Intake
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
