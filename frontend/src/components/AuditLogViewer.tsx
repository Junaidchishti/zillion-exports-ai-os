import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, RefreshCw, Eye, X, FileText, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

export const AuditLogViewer: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getAuditLogs(60);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadLogs();
  }, [user]);

  const filtered = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.entity_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (l.reason && l.reason.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (l.user_full_name && l.user_full_name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="page-body">
      {/* Enterprise Breadcrumb & Hierarchy Banner */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Governance:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">Compliance & Security</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">Immutable Transaction Audit Trail</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node" style={{ color: '#94a3b8' }}>
          Auditor: {user?.fullName} ({user?.roleCode})
        </span>
      </div>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
            <History className="text-cyan" size={24} color="#0284c7" />
            <span>Immutable Factory Audit Trail</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '3px' }}>
            Cryptographically logged timeline of user logins, cutting excess exceptions, 1-hour corrections, and CEO/GM approvals
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Sync Audit Trail</span>
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="console-input"
              style={{ width: '100%', paddingLeft: '36px' }}
              placeholder="Filter audit actions, operators, POs, or reasons..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>
          <span className="badge badge-success" style={{ alignSelf: 'center', padding: '6px 12px' }}>
            <ShieldCheck size={14} />
            <span>Tamper-Evident WAL Log</span>
          </span>
        </div>

        <div className="table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Operator</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>Channel</th>
                <th>Reason / Detail</th>
                <th>Inspection</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No audit records matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {log.created_at?.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.user_full_name || log.user_role || 'SYSTEM'}</td>
                    <td>
                      <span className="badge badge-info">{log.user_role || 'SYS'}</span>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {log.action}
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '12px' }}>{log.entity_name} #{log.entity_id}</span>
                    </td>
                    <td>
                      <span className="badge badge-locked" style={{ fontSize: '10px' }}>{log.source || 'PORTAL'}</span>
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.reason || 'Standard transaction commit'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        onClick={() => setSelectedLog(log)}
                        title="View Full Before / After Diff"
                      >
                        <Eye size={13} />
                        <span>Diff</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before / After Diff Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#0284c7" />
                <span>Audit Detail #{selectedLog.id} — {selectedLog.action}</span>
              </h3>
              <button type="button" className="btn-icon" onClick={() => setSelectedLog(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px', marginBottom: '16px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
              <div><strong>Operator:</strong> {selectedLog.user_full_name} ({selectedLog.user_role})</div>
              <div><strong>Time:</strong> {selectedLog.created_at}</div>
              <div><strong>Target:</strong> {selectedLog.entity_name} #{selectedLog.entity_id}</div>
              <div><strong>Source:</strong> {selectedLog.source}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Logged Rationale:</strong> {selectedLog.reason}</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#10b981', marginBottom: '6px' }}>
                Committed Snapshot Data (After Payload)
              </div>
              <pre
                className="mono"
                style={{
                  backgroundColor: '#090d16',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  color: '#a78bfa',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {typeof selectedLog.new_data === 'string'
                  ? selectedLog.new_data
                  : JSON.stringify(selectedLog.new_data, null, 2)}
              </pre>
            </div>

            {selectedLog.old_data && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#f87171', marginBottom: '6px' }}>
                  Original Snapshot (Before Payload)
                </div>
                <pre
                  className="mono"
                  style={{
                    backgroundColor: '#090d16',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    color: '#94a3b8',
                    maxHeight: '140px',
                    overflowY: 'auto',
                  }}
                >
                  {typeof selectedLog.old_data === 'string'
                    ? selectedLog.old_data
                    : JSON.stringify(selectedLog.old_data, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
