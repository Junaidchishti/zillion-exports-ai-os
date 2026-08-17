import React, { useState, useEffect } from 'react';
import { Search, X, Package, FileText, ArrowRight, Layers, DollarSign, Send, QrCode } from 'lucide-react';
import { api } from '../services/api.js';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPO: (poNumber: string) => void;
  onSelectView: (view: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectPO,
  onSelectView,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [rolls, setRolls] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchSearchData = async () => {
      setLoading(true);
      try {
        const [ords, reqs, rls, invs] = await Promise.all([
          api.getOrders().catch(() => []),
          api.getMyRequests().catch(() => []),
          api.getFabricRolls().catch(() => []),
          api.getSupplierInvoices().catch(() => []),
        ]);
        setOrders(ords);
        setRequests(reqs);
        setRolls(rls);
        setInvoices(invs);
      } catch (err) {
        console.error('Search data load error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSearchData();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const term = searchTerm.toLowerCase().trim();

  const matchingOrders = orders.filter(
    (o) =>
      o.po_number?.toLowerCase().includes(term) ||
      o.customer_name?.toLowerCase().includes(term) ||
      o.style_name?.toLowerCase().includes(term)
  );

  const matchingRequests = requests.filter(
    (r) =>
      r.request_number?.toLowerCase().includes(term) ||
      r.po_number?.toLowerCase().includes(term) ||
      r.request_type?.toLowerCase().includes(term)
  );

  const matchingRolls = rolls.filter(
    (r) =>
      r.roll_barcode?.toLowerCase().includes(term) ||
      r.fabric_type?.toLowerCase().includes(term) ||
      r.warehouse_location?.toLowerCase().includes(term)
  );

  const matchingInvoices = invoices.filter(
    (inv) =>
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.supplier_name?.toLowerCase().includes(term)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', padding: '0', overflow: 'hidden', top: '15%' }}
      >
        {/* Search Input Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <Search size={18} color="#38bdf8" style={{ marginRight: '10px' }} />
          <input
            type="text"
            className="console-input"
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              padding: '0',
              fontSize: '15px',
              color: '#fff',
            }}
            placeholder="Search PO, style, customer, fabric roll, request code, or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Results Body */}
        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '14px' }}>
          {!term ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Type to search across active production orders, fabric rolls, allocation requests, and invoices...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Production Orders Group */}
              {matchingOrders.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Production Orders ({matchingOrders.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {matchingOrders.map((o) => (
                      <div
                        key={o.id}
                        onClick={() => {
                          onSelectPO(o.po_number);
                          onClose();
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{o.po_number}</span>
                          <span style={{ marginLeft: '10px', fontSize: '13px' }}>{o.customer_name} — {o.style_name}</span>
                        </div>
                        <span className="badge badge-info">{o.order_qty} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requests Group */}
              {matchingRequests.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Allocation Requests ({matchingRequests.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {matchingRequests.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          onSelectView('MY_REQUESTS');
                          onClose();
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span className="mono" style={{ fontWeight: 700, color: '#10b981' }}>{r.request_number}</span>
                          <span style={{ marginLeft: '10px', fontSize: '13px' }}>{r.request_type} ({r.po_number})</span>
                        </div>
                        <span className="badge badge-warning">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fabric Rolls Group */}
              {matchingRolls.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Fabric Rolls ({matchingRolls.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {matchingRolls.map((roll) => (
                      <div
                        key={roll.id}
                        onClick={() => {
                          onSelectView('STORE');
                          onClose();
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span className="mono" style={{ fontWeight: 700, color: '#f59e0b' }}>{roll.roll_barcode}</span>
                          <span style={{ marginLeft: '10px', fontSize: '13px' }}>{roll.fabric_type} ({roll.warehouse_location})</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '12px' }}>{roll.remaining_length_meters}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchingOrders.length === 0 && matchingRequests.length === 0 && matchingRolls.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No matching production entities found for "{searchTerm}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
