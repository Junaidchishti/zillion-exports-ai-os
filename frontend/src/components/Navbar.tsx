import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Bell,
  Scan,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Search,
  CheckCircle,
  X,
  Package,
  Layers,
  Send,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { translations, Language } from '../i18n/translations.js';
import { api } from '../services/api.js';
import { NotificationDrawer } from './NotificationDrawer.js';

interface NavbarProps {
  onOpenQRScanner: () => void;
  activeView?: string;
  onSelectView?: (view: string) => void;
  onSelectPO?: (poNumber: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenQRScanner,
  activeView,
  onSelectView,
  onSelectPO,
}) => {
  const { user, language, setLanguage, logout } = useAuth();
  const t = translations[language];

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  // Inline Global Search State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchOrders, setSearchOrders] = useState<any[]>([]);
  const [searchRequests, setSearchRequests] = useState<any[]>([]);
  const [searchRolls, setSearchRolls] = useState<any[]>([]);
  const [searchInvoices, setSearchInvoices] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Notifications
  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {}
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, [user]);

  // Load Search Dataset
  useEffect(() => {
    if (!user) return;
    const fetchSearchData = async () => {
      try {
        const [ords, reqs, rls, invs] = await Promise.all([
          api.getOrders().catch(() => []),
          api.getMyRequests().catch(() => []),
          api.getFabricRolls().catch(() => []),
          api.getSupplierInvoices().catch(() => []),
        ]);
        setSearchOrders(ords);
        setSearchRequests(reqs);
        setSearchRolls(rls);
        setSearchInvoices(invs);
      } catch (err) {}
    };
    fetchSearchData();
  }, [user]);

  // Ctrl+K & Escape Keybinds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setShowUserMenu(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  const toggleLanguage = () => {
    const next: Language = language === 'en' ? 'ur' : 'en';
    setLanguage(next);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
      );
    } catch (e) {}
  };

  // Filter Search Entities
  const term = searchTerm.toLowerCase().trim();
  const matchingOrders = term
    ? searchOrders.filter(
        (o) =>
          o.po_number?.toLowerCase().includes(term) ||
          o.customer_name?.toLowerCase().includes(term) ||
          o.style_name?.toLowerCase().includes(term)
      )
    : [];

  const matchingRequests = term
    ? searchRequests.filter(
        (r) =>
          r.request_number?.toLowerCase().includes(term) ||
          r.po_number?.toLowerCase().includes(term) ||
          r.request_type?.toLowerCase().includes(term)
      )
    : [];

  const matchingRolls = term
    ? searchRolls.filter(
        (r) =>
          r.roll_barcode?.toLowerCase().includes(term) ||
          r.fabric_type?.toLowerCase().includes(term) ||
          r.warehouse_location?.toLowerCase().includes(term)
      )
    : [];

  const matchingInvoices = term
    ? searchInvoices.filter(
        (inv) =>
          inv.invoice_number?.toLowerCase().includes(term) ||
          inv.supplier_name?.toLowerCase().includes(term)
      )
    : [];

  const hasSearchResults =
    matchingOrders.length > 0 ||
    matchingRequests.length > 0 ||
    matchingRolls.length > 0 ||
    matchingInvoices.length > 0;

  return (
    <header
      className="navbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: '64px',
        backgroundColor: '#0b1329',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 80,
      }}
    >
      {/* Brand & Department Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)',
            flexShrink: 0,
          }}
        >
          <Shield size={22} />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            ZILLION EXPORTS
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>
            AI Factory Operating System
          </div>
        </div>

        {/* Large Prominent Department Badge */}
        <div
          style={{
            marginLeft: '12px',
            padding: '5px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(2, 132, 199, 0.2)',
            border: '1px solid #0284c7',
            color: '#38bdf8',
            fontWeight: 800,
            fontSize: '12.5px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
          <span>{user?.departmentCode || 'EXECUTIVE'}</span>
        </div>
      </div>

      {/* Inline Global Search Bar (Direct in Header, NO POPUP MODAL) */}
      <div ref={searchContainerRef} style={{ position: 'relative', width: '380px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: `1px solid ${isSearchOpen ? '#0284c7' : 'rgba(255, 255, 255, 0.14)'}`,
            borderRadius: '20px',
            padding: '7px 14px',
            transition: 'all 0.15s ease',
          }}
        >
          <Search size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            className="console-input"
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              padding: '0',
              fontSize: '12.5px',
              color: '#fff',
            }}
            placeholder="Search PO, style, roll, request, invoice..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
          />
          {searchTerm ? (
            <button
              type="button"
              className="btn-icon"
              style={{ padding: '0', color: '#94a3b8' }}
              onClick={() => {
                setSearchTerm('');
                setIsSearchOpen(false);
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <kbd
              style={{
                fontSize: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 5px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontWeight: 600,
              }}
            >
              Ctrl+K
            </kbd>
          )}
        </div>

        {/* Live Search Results Dropdown (Directly Below Search Bar) */}
        {isSearchOpen && term && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: '46px',
              left: 0,
              width: '460px',
              maxHeight: '380px',
              overflowY: 'auto',
              backgroundColor: '#0f172a',
              border: '1px solid #0284c7',
              borderRadius: '10px',
              padding: '12px',
              zIndex: 120,
              boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
            }}
          >
            {!hasSearchResults ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                No active records found for "{searchTerm}".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Orders Group */}
                {matchingOrders.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Production Orders ({matchingOrders.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matchingOrders.map((o) => (
                        <div
                          key={o.id}
                          onClick={() => {
                            if (onSelectPO) onSelectPO(o.po_number);
                            setIsSearchOpen(false);
                            setSearchTerm('');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>{o.po_number}</span>
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f8fafc' }}>{o.customer_name} • {o.style_name}</span>
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
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Allocation Requests ({matchingRequests.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matchingRequests.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => {
                            if (onSelectView) onSelectView('MY_REQUESTS');
                            setIsSearchOpen(false);
                            setSearchTerm('');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span className="mono" style={{ fontWeight: 700, color: '#10b981' }}>{r.request_number}</span>
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f8fafc' }}>{r.request_type} ({r.po_number})</span>
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
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Fabric Rolls ({matchingRolls.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matchingRolls.map((roll) => (
                        <div
                          key={roll.id}
                          onClick={() => {
                            if (onSelectView) onSelectView('STORE');
                            setIsSearchOpen(false);
                            setSearchTerm('');
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span className="mono" style={{ fontWeight: 700, color: '#f59e0b' }}>{roll.roll_barcode}</span>
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f8fafc' }}>{roll.fabric_type} ({roll.warehouse_location})</span>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '11px', color: '#38bdf8' }}>{roll.remaining_length_meters}m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Language Selector */}
        <button
          type="button"
          id="btn-lang-toggle"
          className="btn btn-secondary btn-sm"
          onClick={toggleLanguage}
          title="Switch Language (English / اردو)"
        >
          <Globe size={14} />
          <span style={{ fontWeight: 700 }}>{language === 'en' ? 'اردو' : 'English'}</span>
        </button>

        {/* Traceability Scanner */}
        <button
          type="button"
          id="btn-nav-qr"
          className="btn btn-secondary btn-sm"
          onClick={onOpenQRScanner}
          title="Open Industrial QR & Barcode Scanner"
        >
          <Scan size={14} color="#0284c7" />
          <span>Scan QR</span>
        </button>

        {/* Notifications Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            id="btn-nav-notifications"
            className="btn-icon"
            onClick={() => setShowNotificationDrawer(!showNotificationDrawer)}
            title="Notifications & Alarms"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0b1329',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <NotificationDrawer
            isOpen={showNotificationDrawer}
            onClose={() => setShowNotificationDrawer(false)}
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onNavigateToView={(view) => {
              if (onSelectView) onSelectView(view);
            }}
          />
        </div>

        {/* User Profile Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            id="btn-nav-user"
            className="btn btn-secondary btn-sm"
            style={{ gap: '8px' }}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <span style={{ fontWeight: 600 }}>{user?.fullName || user?.username}</span>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {showUserMenu && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: '46px',
                right: '0',
                width: '240px',
                padding: '12px',
                zIndex: 100,
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>{user?.fullName}</div>
                <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>Role: {user?.roleCode}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Dept: {user?.departmentCode}</div>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
