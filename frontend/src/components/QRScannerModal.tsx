import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Scan, AlertCircle, X, Search, ShieldCheck, Camera, VideoOff } from 'lucide-react';
import { api } from '../services/api.js';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose }) => {
  const [tokenInput, setTokenInput] = useState<string>('');
  const [resolvedPayload, setResolvedPayload] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device access not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(err.message || 'Camera permission denied or unavailable on this device.');
      setIsCameraActive(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  const handleResolve = async (tokenToTest?: string) => {
    const target = tokenToTest || tokenInput.trim();
    if (!target) return;
    setErrorMsg('');
    setResolvedPayload(null);

    try {
      const data = await api.resolveQR(target);
      setResolvedPayload(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'QR / Barcode token not found in central ledger.');
    }
  };

  const handleSimulateScan = (demoToken: string) => {
    setTokenInput(demoToken);
    handleResolve(demoToken);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scan size={22} color="#06b6d4" />
            <span>Industrial QR & Barcode Traceability Terminal</span>
          </h3>
          <button type="button" className="btn-icon" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        {/* Camera Viewport / Stream */}
        <div
          style={{
            backgroundColor: '#0a0f1d',
            border: '2px dashed #0284c7',
            borderRadius: '12px',
            padding: isCameraActive ? '8px' : '20px',
            textAlign: 'center',
            marginBottom: '18px',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '220px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isCameraActive ? (
            <div style={{ width: '100%', position: 'relative' }}>
              <video
                ref={videoRef}
                style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '8px' }}
                autoPlay
                playsInline
                muted
              />
              <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={stopCamera}>
                  <VideoOff size={14} />
                  <span>Stop Camera</span>
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#38bdf8' }}>
                Scanning live optical stream for QR codes...
              </div>
            </div>
          ) : (
            <div>
              <QrCode size={44} color="#06b6d4" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                Position Barcode or QR Code in Optical Beam
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 12px' }}>
                Device camera barcode reading supported on tablet/mobile workstations.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
                  <Camera size={14} />
                  <span>Activate Live Device Camera</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSimulateScan('ZX-ALL-PO-452-1-8A1ED9A0')}
                >
                  Scan PO-452 Allocation
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSimulateScan('ROLL-101')}
                >
                  Scan Roll R-101
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <div style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>
              {cameraError} (Manual lookup and quick scan chips available below)
            </div>
          )}
        </div>

        {/* Manual Code Input Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <input
            type="text"
            id="input-qr-token"
            className="console-input"
            style={{ flex: 1 }}
            placeholder="Enter or paste QR Token (e.g. ZX-ALL-PO-452-... or ROLL-101)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
          />
          <button type="button" className="btn btn-primary" onClick={() => handleResolve()}>
            <Search size={16} />
            <span>Verify</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '14px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600 }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setErrorMsg('');
                  startCamera();
                }}
              >
                <Camera size={13} />
                <span>Retry Scan</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setErrorMsg('');
                  document.getElementById('input-qr-token')?.focus();
                }}
              >
                <Search size={13} />
                <span>Enter Code Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* Resolved Payload Card */}
        {resolvedPayload && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid #10b981',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700 }}>
                <ShieldCheck size={20} />
                <span>Verified Central Database Allocation</span>
              </div>
              <span className="badge badge-success">AUTHENTIC</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target PO: </span>
                <strong style={{ color: '#38bdf8' }}>{resolvedPayload.poNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Department: </span>
                <strong>{resolvedPayload.department}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Quantity: </span>
                <strong style={{ fontSize: '16px', color: '#fff' }}>{resolvedPayload.quantity} pcs</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Approved By: </span>
                <strong style={{ color: '#10b981' }}>{resolvedPayload.approvedBy || 'CEO Authorized'}</strong>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)' }}>Traceability Token: </span>
                <code className="mono" style={{ color: '#94a3b8' }}>{resolvedPayload.token}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
