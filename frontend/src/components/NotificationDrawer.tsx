import React, { useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, Check } from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  onMarkRead: (id: number) => void;
  onNavigateToView: (view: string, targetId?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onNavigateToView,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const bellButton = document.getElementById('btn-nav-notifications');
      if (bellButton && bellButton.contains(e.target as Node)) {
        return; // Bell button handles its own toggle
      }
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  const getSeverityStyle = (title: string) => {
    if (title.includes('🚨') || title.includes('HOLD') || title.includes('EXCESS')) {
      return { border: '1px solid #ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: ShieldAlert, color: '#f87171' };
    }
    if (title.includes('Approval') || title.includes('Pending')) {
      return { border: '1px solid #f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: AlertTriangle, color: '#fbbf24' };
    }
    return { border: '1px solid var(--border-subtle)', bg: 'var(--bg-secondary)', icon: Bell, color: '#38bdf8' };
  };

  return (
    <div
      ref={drawerRef}
      style={{
        position: 'fixed',
        top: '64px',
        right: '0',
        width: '380px',
        maxHeight: 'calc(100vh - 74px)',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-medium)',
        borderBottom: '1px solid var(--border-medium)',
        borderBottomLeftRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} color="#38bdf8" />
          <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Factory Notification Center</span>
          <span className="badge badge-info">{unreadCount} Unread</span>
        </div>
        <button type="button" className="btn-icon" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      {/* Notifications List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 10px' }} />
            <div>No active alarms or notifications.</div>
          </div>
        ) : (
          notifications.map((n) => {
            const sev = getSeverityStyle(n.title);
            const Icon = sev.icon;

            return (
              <div
                key={n.id}
                style={{
                  backgroundColor: n.status === 'UNREAD' ? sev.bg : 'var(--bg-primary)',
                  border: sev.border,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  onMarkRead(n.id);
                  if (n.title.includes('Approval')) {
                    onNavigateToView('APPROVALS');
                  } else if (n.title.includes('CUTTING') || n.title.includes('EXCESS')) {
                    onNavigateToView('CUTTING');
                  } else if (n.title.includes('QC') || n.title.includes('HOLD')) {
                    onNavigateToView('QUALITY');
                  }
                  onClose();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Icon size={16} color={sev.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#fff' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {n.status === 'UNREAD' && (
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>Click to resolve</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
