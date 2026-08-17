import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { LiveExecutiveDashboard } from './components/LiveExecutiveDashboard.js';
import { CuttingWorkstation } from './components/CuttingWorkstation.js';
import { DepartmentWorkstation } from './components/DepartmentWorkstations.js';
import { FinanceCenter } from './components/FinanceCenter.js';
import { RequestApprovalCenter } from './components/RequestApprovalCenter.js';
import { RequestCreationPortal } from './components/RequestCreationPortal.js';
import { AIAgentWorkspace } from './components/AIAgentWorkspace.js';
import { UniversalPODetailView } from './components/UniversalPODetailView.js';
import { AuditLogViewer } from './components/AuditLogViewer.js';
import { QRScannerModal } from './components/QRScannerModal.js';
import { LoginModal } from './components/LoginModal.js';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState<string>('DASHBOARD');
  const [selectedPONumber, setSelectedPONumber] = useState<string>('PO-452');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);

  // Set initial default view according to user role upon login
  useEffect(() => {
    if (!user) return;
    const role = user.roleCode;
    if (role === 'CEO' || role === 'GENERAL_MANAGER') {
      setActiveView('DASHBOARD');
    } else if (role === 'FINANCE_OFFICER') {
      setActiveView('FINANCE');
    } else {
      setActiveView(user.departmentCode || 'CUTTING');
    }
  }, [user]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b1120',
          color: '#38bdf8',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              margin: '0 auto 16px',
              width: '40px',
              height: '40px',
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.04em' }}>
            ZILLION EXPORTS — AI FACTORY OS
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
            Verifying secure session token...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const isExecutive = user.roleCode === 'CEO' || user.roleCode === 'GENERAL_MANAGER';
  const isFinance = user.roleCode === 'FINANCE_OFFICER';
  const userDept = user.departmentCode || 'CUTTING';

  const handleSelectView = (view: string) => {
    // Validate if user has permission to navigate to this view
    if (!isExecutive) {
      if (isFinance) {
        if (view !== 'FINANCE' && view !== 'AI_AGENT' && view !== 'MY_REQUESTS' && view !== 'AUDIT' && view !== 'UNIVERSAL_PO') {
          return;
        }
      } else {
        // Normal departmental user
        if (
          view !== userDept &&
          view !== 'AI_AGENT' &&
          view !== 'UNIVERSAL_PO' &&
          view !== 'MY_REQUESTS' &&
          view !== 'MY_AUDIT'
        ) {
          return;
        }
      }
    }
    setActiveView(view);
  };

  const handleSelectPOFromSearch = (poNumber: string) => {
    setSelectedPONumber(poNumber);
    setActiveView('UNIVERSAL_PO');
  };

  return (
    <div className="app-container">
      {/* Top Executive Header with Inline Global Search */}
      <Navbar
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        activeView={activeView}
        onSelectView={handleSelectView}
        onSelectPO={handleSelectPOFromSearch}
      />

      {/* Main Workspace Layout */}
      <div className="main-content-layout">
        <Sidebar activeView={activeView} onSelectView={handleSelectView} />

        <main className="content-area">
          {/* Executive & GM Dashboards */}
          {activeView === 'DASHBOARD' && isExecutive && (
            <LiveExecutiveDashboard onOpenQRScanner={() => setIsQRScannerOpen(true)} />
          )}

          {/* Dedicated 3-Panel AI Agent Workspace */}
          {activeView === 'AI_AGENT' && (
            <AIAgentWorkspace
              department={userDept}
              onNavigateToPO={(po) => {
                setSelectedPONumber(po);
                setActiveView('UNIVERSAL_PO');
              }}
            />
          )}

          {/* Universal PO Pipeline Detail View */}
          {activeView === 'UNIVERSAL_PO' && (
            <UniversalPODetailView
              poNumber={selectedPONumber}
              onBack={() => setActiveView(isExecutive ? 'DASHBOARD' : userDept)}
              onNavigateToDept={(dept) => handleSelectView(dept)}
            />
          )}

          {/* Department Workstations */}
          {activeView === 'ORDERS' && (isExecutive || userDept === 'MERCHANDISING') && (
            <DepartmentWorkstation department="MERCHANDISING" />
          )}

          {activeView === 'PROCUREMENT' && (isExecutive || userDept === 'PROCUREMENT') && (
            <DepartmentWorkstation department="PROCUREMENT" />
          )}

          {activeView === 'CUTTING' && (isExecutive || userDept === 'CUTTING') && (
            <CuttingWorkstation />
          )}

          {activeView === 'STORE' && (isExecutive || userDept === 'STORE') && (
            <DepartmentWorkstation department="STORE" />
          )}

          {activeView === 'STITCHING' && (isExecutive || userDept === 'STITCHING') && (
            <DepartmentWorkstation department="STITCHING" />
          )}

          {activeView === 'WASHING' && (isExecutive || userDept === 'WASHING') && (
            <DepartmentWorkstation department="WASHING" />
          )}

          {activeView === 'FINISHING' && (isExecutive || userDept === 'FINISHING') && (
            <DepartmentWorkstation department="FINISHING" />
          )}

          {activeView === 'QUALITY' && (isExecutive || userDept === 'QUALITY') && (
            <DepartmentWorkstation department="QUALITY" />
          )}

          {activeView === 'PACKING' && (isExecutive || userDept === 'PACKING') && (
            <DepartmentWorkstation department="PACKING" />
          )}

          {activeView === 'SHIPMENT' && (isExecutive || userDept === 'SHIPMENT') && (
            <DepartmentWorkstation department="SHIPMENT" />
          )}

          {/* Finance Center */}
          {activeView === 'FINANCE' && (isExecutive || isFinance) && (
            <FinanceCenter />
          )}

          {/* Request Creation & Tracking Portal (Departmental Users + Global) */}
          {(activeView === 'MY_REQUESTS' || activeView === 'GLOBAL_REQUESTS') && (
            <RequestCreationPortal
              department={userDept}
              onOpenQRScanner={() => setIsQRScannerOpen(true)}
            />
          )}

          {/* Executive Approvals Portal (CEO & GM Only) */}
          {activeView === 'APPROVALS' && isExecutive && (
            <RequestApprovalCenter />
          )}

          {/* Audit Logs */}
          {(activeView === 'AUDIT' || activeView === 'MY_AUDIT') && (
            <AuditLogViewer />
          )}
        </main>
      </div>

      {/* Industrial QR & Barcode Traceability Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
      />
    </div>
  );
};
