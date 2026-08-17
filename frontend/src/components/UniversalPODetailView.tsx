import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  Activity,
  Droplets,
  Sparkles,
  CheckSquare,
  Box,
  Truck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  Printer,
  FileText,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

interface UniversalPODetailViewProps {
  poNumber: string;
  onBack?: () => void;
  onNavigateToDept?: (dept: string) => void;
}

export const UniversalPODetailView: React.FC<UniversalPODetailViewProps> = ({
  poNumber,
  onBack,
  onNavigateToDept,
}) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewData, ordersData] = await Promise.all([
        api.getProductionOverview(),
        api.getOrders(),
      ]);

      const foundOrder = ordersData.find((o: any) => o.po_number === poNumber) || ordersData[0];
      setOrder(foundOrder);

      const targetPO = foundOrder?.po_number || poNumber;
      const pipeItem = overviewData.find((p: any) => p.poNumber === targetPO);

      if (pipeItem && pipeItem.stages) {
        const orderQty = foundOrder?.order_qty || 5000;
        const stages = [
          {
            id: 'ERP',
            name: 'Order Intake & BOM',
            completedQty: orderQty,
            totalQty: orderQty,
            status: 'COMPLETED',
            icon: FileText,
          },
          {
            id: 'STORE',
            name: 'Fabric & Trims Store',
            completedQty: Math.round(orderQty * 1.05),
            totalQty: orderQty,
            status: 'COMPLETED',
            icon: Package,
          },
          {
            id: 'CUTTING',
            name: 'Lay & Cutting',
            completedQty: pipeItem.stages.CUTTING?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.CUTTING?.status || 'IN_PROGRESS',
            icon: Layers,
          },
          {
            id: 'STITCHING',
            name: 'Stitching (CMT)',
            completedQty: pipeItem.stages.STITCHING?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.STITCHING?.status || 'PENDING',
            icon: Activity,
          },
          {
            id: 'WASHING',
            name: 'Washing Department',
            completedQty: pipeItem.stages.WASHING?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.WASHING?.status || 'PENDING',
            icon: Droplets,
          },
          {
            id: 'FINISHING',
            name: 'Finishing & Pressing',
            completedQty: pipeItem.stages.FINISHING?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.FINISHING?.status || 'PENDING',
            icon: Sparkles,
          },
          {
            id: 'QUALITY',
            name: 'Quality Control (QC)',
            completedQty: pipeItem.stages.QUALITY?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.QUALITY?.status || 'PENDING',
            icon: CheckSquare,
          },
          {
            id: 'PACKING',
            name: 'Carton Packing',
            completedQty: pipeItem.stages.PACKING?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.PACKING?.status || 'PENDING',
            icon: Box,
          },
          {
            id: 'SHIPMENT',
            name: 'Export & Dispatch',
            completedQty: pipeItem.stages.SHIPMENT?.completed || 0,
            totalQty: orderQty,
            status: pipeItem.stages.SHIPMENT?.status || 'PENDING',
            icon: Truck,
          },
        ];
        setPipeline(stages);
      }
    } catch (err) {
      console.error('Failed to load PO detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poNumber]);

  if (loading || !order) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: 'var(--text-secondary)' }}>Loading Universal PO Traceability Record...</div>
      </div>
    );
  }

  const orderQty = order.order_qty || 5000;
  const unitPrice = order.unit_price || 16.50;
  const totalValue = orderQty * unitPrice;

  return (
    <div className="page-body">
      {/* Top Header & Breadcrumb */}
      <div className="enterprise-breadcrumb">
        <span className="breadcrumb-label">Traceability:</span>
        <span className="breadcrumb-node">Zillion Exports</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node">Production Orders</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-node active">{order.po_number}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
          )}
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}>
              <Package size={22} color="#0284c7" />
              <span>Universal Order Tracker: {order.po_number}</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
              {order.customer_name} • Style {order.style_name} • {order.color_name} • Delivery: {order.target_delivery_date}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={14} />
            <span>Print PO Spec</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Sync Live Pipeline</span>
          </button>
        </div>
      </div>

      {/* PO Specification Cards */}
      <div className="metric-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card border-cyan">
          <div className="metric-label">
            <span>Order Quantity</span>
            <Package size={14} color="#38bdf8" />
          </div>
          <div className="metric-value tabular-num">{orderQty.toLocaleString()} pcs</div>
          <div className="metric-subtext">Max Allowed (105%): {Math.round(orderQty * 1.05).toLocaleString()} pcs</div>
        </div>

        <div className="metric-card border-emerald">
          <div className="metric-label">
            <span>Total Contract Value</span>
            <DollarSign size={14} color="#10b981" />
          </div>
          <div className="metric-value tabular-num">${totalValue.toLocaleString()}</div>
          <div className="metric-subtext">Unit Price: ${unitPrice.toFixed(2)} / pc</div>
        </div>

        <div className="metric-card border-amber">
          <div className="metric-label">
            <span>Target Delivery</span>
            <Clock size={14} color="#f59e0b" />
          </div>
          <div className="metric-value" style={{ fontSize: '20px' }}>{order.target_delivery_date}</div>
          <div className="metric-subtext">Status: {order.status}</div>
        </div>

        <div className="metric-card border-rose">
          <div className="metric-label">
            <span>Fabric Specification</span>
            <Layers size={14} color="#f43f5e" />
          </div>
          <div className="metric-value" style={{ fontSize: '16px', lineHeight: 1.3 }}>{order.fabric_type || '12oz Indigo Denim'}</div>
          <div className="metric-subtext">Standard Cons: 1.35m / pc</div>
        </div>
      </div>

      {/* Complete Downstream Manufacturing Lifecycle Progression Pipeline */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Activity size={17} color="#0284c7" />
            <span>End-to-End Manufacturing Lifecycle Pipeline</span>
          </div>
          <span className="badge badge-info">Real-time SQL Progress</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pipeline.map((stg, idx) => {
            const Icon = stg.icon || Activity;
            const pct = Math.min(100, Math.round(((stg.completedQty || 0) / orderQty) * 100));
            const remaining = Math.max(0, orderQty - (stg.completedQty || 0));

            return (
              <div
                key={stg.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: pct >= 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                        color: pct >= 100 ? '#10b981' : '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={15} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{idx + 1}. {stg.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({stg.id})</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="mono tabular-num" style={{ fontWeight: 700, fontSize: '13px' }}>
                      {stg.completedQty?.toLocaleString()} / {orderQty.toLocaleString()} pcs ({pct}%)
                    </span>
                    <span
                      className={`badge ${
                        stg.status === 'COMPLETED'
                          ? 'badge-success'
                          : stg.status === 'IN_PROGRESS'
                          ? 'badge-info'
                          : 'badge-locked'
                      }`}
                    >
                      {stg.status}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    height: '6px',
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? '#10b981' : '#0284c7',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
