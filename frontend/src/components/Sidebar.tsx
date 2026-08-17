import React from 'react';
import {
  LayoutDashboard,
  Bot,
  Scissors,
  Package,
  Activity,
  Droplets,
  Sparkles,
  CheckSquare,
  Box,
  Truck,
  DollarSign,
  FileCheck2,
  History,
  Mail,
  ShoppingCart,
  Send,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { translations } from '../i18n/translations.js';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelectView }) => {
  const { language, user } = useAuth();
  const t = translations[language];

  const role = user?.roleCode || 'CUTTING_MASTER';
  const isCEO = role === 'CEO';
  const isGM = role === 'GENERAL_MANAGER';
  const isFinance = role === 'FINANCE_OFFICER';

  let sections: { title: string; items: { id: string; label: string; icon: any }[] }[] = [];

  if (isCEO) {
    sections = [
      {
        title: 'Executive Command',
        items: [
          { id: 'DASHBOARD', label: 'Company Command Center', icon: LayoutDashboard },
          { id: 'AI_AGENT', label: 'Central AI Intelligence', icon: Bot },
          { id: 'UNIVERSAL_PO', label: 'Universal PO Pipeline', icon: Layers },
          { id: 'APPROVALS', label: 'Executive Approvals', icon: FileCheck2 },
          { id: 'GLOBAL_REQUESTS', label: 'Company Requests', icon: Send },
          { id: 'AUDIT', label: 'Central Audit Trail', icon: History },
        ],
      },
      {
        title: 'Order Intake & Supply',
        items: [
          { id: 'ORDERS', label: 'Orders (BOM Intake)', icon: Mail },
          { id: 'PROCUREMENT', label: 'ERP & Procurement', icon: ShoppingCart },
          { id: 'STORE', label: 'Store & Fabric Rolls', icon: Package },
        ],
      },
      {
        title: 'Manufacturing Floor',
        items: [
          { id: 'CUTTING', label: 'Cutting Workstation', icon: Scissors },
          { id: 'STITCHING', label: 'Stitching (CMT)', icon: Activity },
          { id: 'WASHING', label: 'Washing Department', icon: Droplets },
          { id: 'FINISHING', label: 'Finishing Department', icon: Sparkles },
          { id: 'QUALITY', label: 'Quality Control (QC)', icon: CheckSquare },
          { id: 'PACKING', label: 'Packing Department', icon: Box },
          { id: 'SHIPMENT', label: 'Shipment & Logistics', icon: Truck },
        ],
      },
      {
        title: 'Corporate Finance',
        items: [
          { id: 'FINANCE', label: 'Finance & Piece-Rates', icon: DollarSign },
        ],
      },
    ];
  } else if (isGM) {
    sections = [
      {
        title: 'Operations Oversight',
        items: [
          { id: 'DASHBOARD', label: 'Operations Command Center', icon: LayoutDashboard },
          { id: 'AI_AGENT', label: 'Operations AI Assistant', icon: Bot },
          { id: 'UNIVERSAL_PO', label: 'Universal PO Pipeline', icon: Layers },
          { id: 'APPROVALS', label: 'Floor Approvals Review', icon: FileCheck2 },
          { id: 'GLOBAL_REQUESTS', label: 'Floor Requests', icon: Send },
          { id: 'AUDIT', label: 'Operations Audit Trail', icon: History },
        ],
      },
      {
        title: 'Manufacturing Floor',
        items: [
          { id: 'STORE', label: 'Store & Rolls', icon: Package },
          { id: 'CUTTING', label: 'Cutting Workstation', icon: Scissors },
          { id: 'STITCHING', label: 'Stitching (CMT)', icon: Activity },
          { id: 'WASHING', label: 'Washing Workstation', icon: Droplets },
          { id: 'FINISHING', label: 'Finishing Workstation', icon: Sparkles },
          { id: 'QUALITY', label: 'Quality Control (QC)', icon: CheckSquare },
          { id: 'PACKING', label: 'Packing Workstation', icon: Box },
          { id: 'SHIPMENT', label: 'Shipment Workstation', icon: Truck },
        ],
      },
    ];
  } else if (isFinance) {
    sections = [
      {
        title: 'Finance & Accounts',
        items: [
          { id: 'FINANCE', label: 'Finance Dashboard', icon: DollarSign },
          { id: 'AI_AGENT', label: 'Finance AI Assistant', icon: Bot },
          { id: 'UNIVERSAL_PO', label: 'Universal PO Tracker', icon: Layers },
          { id: 'MY_REQUESTS', label: 'Financial Requests', icon: Send },
          { id: 'AUDIT', label: 'Financial Audit Trail', icon: History },
        ],
      },
    ];
  } else {
    // Departmental Roles: Cutting, Store, Stitching, Washing, Finishing, QC, Packing, Shipment, Merch
    const dept = user?.departmentCode || 'CUTTING';
    const deptIcons: Record<string, any> = {
      CUTTING: Scissors,
      STORE: Package,
      STITCHING: Activity,
      WASHING: Droplets,
      FINISHING: Sparkles,
      QUALITY: CheckSquare,
      PACKING: Box,
      SHIPMENT: Truck,
      MERCHANDISING: Mail,
    };
    const DeptIcon = deptIcons[dept] || Scissors;

    sections = [
      {
        title: `${dept} Department Scope`,
        items: [
          { id: dept, label: `${dept} Operational Workstation`, icon: DeptIcon },
          { id: 'AI_AGENT', label: `${dept} AI Agent Workspace`, icon: Bot },
          { id: 'UNIVERSAL_PO', label: 'Universal PO Tracker', icon: Layers },
          { id: 'MY_REQUESTS', label: 'My Requests & Handovers', icon: Send },
          { id: 'MY_AUDIT', label: 'Department Audit Trail', icon: History },
        ],
      },
    ];
  }

  return (
    <aside className="sidebar">
      {sections.map((sec, idx) => (
        <div key={idx} className="sidebar-nav-section">
          <div className="sidebar-section-title">{sec.title}</div>
          <nav>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  id={`nav-link-${item.id.toLowerCase()}`}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectView(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
};
