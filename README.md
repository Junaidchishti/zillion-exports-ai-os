# Zillion Exports — AI Factory Operating System 🏭👖

A production-grade, multi-agent AI manufacturing operating system engineered for garments and jeans manufacturing and export operations.

---

## 🌟 Key Highlights & Core Capabilities

1. **Multi-Agent Architecture**:
   - **Cutting Agent (Reference Implementation)**: End-to-end voice and text natural language data entry, automated scrap/waste % and efficiency math, roll yardage deduction, 1-hour grace editable window, and handover requests.
   - **CEO / GM Intelligence & Command Layer**: Real-time natural language query resolution against live database records, and executive command dispatch with role authorization and audit logging.
   - **Department Agents**: Store/Inventory, Stitching/CMT, Washing, Finishing, QC (with **Packing Hold**), Packing, Shipment, and Finance.
2. **Deterministic Security & Data Locking**:
   - **1-Hour Grace Window**: Submitter can edit records within 60 minutes with mandatory reason capture.
   - **Strict Lock**: After 60 minutes, records are sealed; direct edits are blocked unless authorized by CEO/GM.
   - **No Direct AI Mutations**: AI strictly formats proposed payloads; all mutations pass through business validation, inventory constraints, and explicit confirmation.
3. **Session-Level Bilingual Engine**:
   - **English & Urdu (اردو)**: Web Speech STT (Speech-to-Text) and TTS (Voice Synthesis) with technical production terms (*PO, Style, Fabric, CMT, QC, Roll ID*) standardized. Roman Urdu is disallowed.
4. **QR & Barcode Traceability**:
   - Cryptographic QR code generation on CEO/GM approval of inter-department transfers and fabric rolls.
   - Integrated scanner for real-time tracking across production lines.
5. **Central Relational Database (Single Source of Truth)**:
   - Normalized 3NF SQLite database with strict foreign keys, indexes, and write-ahead logging.

---

## 🚀 Quick Start Guide

### 1. Run Automated Test Suite
To verify the complete database schema, authentication, Cutting Agent flow, 1-hour locking, approvals, QR codes, and CEO live intelligence:
```bash
cd backend
npm test
```

### 2. Start Backend Server
```bash
cd backend
npm run dev
```
Backend API will start at `http://localhost:5000`.

### 3. Start Frontend UI
```bash
cd frontend
npm run dev
```
Frontend workstation will be available at `http://localhost:5173`.

---

## 👥 Default Demo Accounts

All test accounts share the default password: `factory123`

| Role | Username | Full Name | Department | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **CEO** | `ceo_tariq` | Tariq Mahmood | Executive | Full company visibility, approvals, AI intelligence, commands |
| **General Manager** | `gm_aslam` | Aslam Sheikh | Operations | Delegated approvals, operational commands, factory oversight |
| **Cutting Master** | `cutting_akram` | Master Akram | Cutting | Roll consumption, size breakdown, voice logging, CMT requests |
| **Store Master** | `store_rashid` | Rashid Khan | Store | Fabric roll receipts, inventory movements, stock ledger |
| **QC Lead** | `qc_hamza` | Hamza Malik | Quality | AQL audits, defect triage, **Packing Hold** activation |
| **Finance Officer** | `finance_salman` | Salman Qazi | Finance | Payables (30/60/90 days), Receivables, Master piece-rates |

---

## 🎙️ Sample Voice Commands (English & Urdu)

### Cutting Master Commands:
- **English**: *"PO 452, Roll 101, 1320 meters consumed, 1000 pieces cut with sizes: 28: 200, 30: 400, 32: 400"*
- **Urdu**: *"PO 452، Roll 101 میں سے 1320 میٹر کپڑا لگا کر 1000 پیس کٹ کیے، سائز: 28: 200، 30: 400، 32: 400"*

### CEO Intelligence Queries:
- *"What is the status of PO 452?"*
- *"How much fabric was wasted?"*
- *"Which supplier payments are due?"*
- *"Which department is currently behind schedule?"*
- *"Tell Cutting to prioritize PO 452."*

---

## 📊 Central Database Schema Entities

- **Auth & Security**: `users`, `roles`, `permissions`, `auth_sessions`, `audit_logs`
- **Master Data**: `customers`, `suppliers`, `styles`, `colors`, `sizes`, `production_masters`, `master_rates`
- **Orders & BOM**: `orders`, `order_size_breakdowns`, `purchase_orders`
- **Inventory & Traceability**: `fabric_rolls`, `accessories`, `inventory_transactions`, `allocation_requests`, `qr_codes`, `approvals`
- **Production Logs**: `cutting_entries`, `cutting_size_breakdown`, `stitching_entries`, `washing_entries`, `finishing_entries`, `qc_entries`, `packing_entries`, `shipment_entries`
- **Financials**: `supplier_invoices`, `customer_receivables`, `master_production_ledger`, `master_payments`
- **System**: `notifications`
