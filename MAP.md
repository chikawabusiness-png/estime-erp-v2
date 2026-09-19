# Perfume Shop ERP - MAP

This document is the single source of truth for the Perfume Shop ERP. It records the architecture, data model, workflows, automation rules, security model, migration path, and implementation status. Any architectural change must be added to the Change Log.

## 1. Project Overview

| Item | Description |
| --- | --- |
| Goal | Build a low-cost, modular ERP for perfume manufacturing and sales. |
| Current implementation | React 18 + Vite, Tailwind/DaisyUI, Supabase Postgres/Auth/Storage/RLS/Edge Functions, Netlify deployment. |
| Planned starting process | Google Sheets + Scan-IT + WD-Link 8270 thermal printer where a spreadsheet-first rollout is required. |
| Core modules | Stock, products, customers, orders, invoices, QR codes, dashboard. |
| End-to-end flow | Raw material -> production -> storage -> order -> packaging -> delivery -> payment -> reporting. |
| Constraints | Low budget, limited IT expertise, portable data, Arabic-speaking users. |
| Future vision | Procurement, production planning, CRM, finance, BI, mobile scanning, and multi-tenant SaaS. |

### Problems solved

- Manual stock tracking errors through transactional inventory updates.
- Disconnected order and production data through one relational source of truth.
- Paper-only invoices through printable, QR-linked invoice records.
- Missing alerts through low-stock notification automation.

## 2. Business Process

```text
[Raw Materials] -> [Procurement] -> [Production] -> [Packaging] -> [Inventory]
       |                                                    |
   [Suppliers]                                          [Warehouse]
       |                                                    |
[Purchase Orders] <-> [Stock Updates] <-> [Sales Orders]
       |                         |                         |
   [Clients]              [Invoices] <-> [Payments]
                                  |
                    [Delivery] <-> [Returns] <-> [Reporting]
```

### Operational rules

1. Production completion increases finished-product inventory and consumes raw materials.
2. A confirmed order reserves stock and must not oversell available units.
3. Shipment converts reservation into a completed stock movement and delivery record.
4. A valid return restores inventory and records the reason, order, product, and operator.
5. Payments update order financial status and support profit reporting.
6. Inventory below its reorder threshold generates an alert.
7. QR payloads remain stable across every implementation phase.

## 3. Architecture and Phases

| Layer | Phase 1 | Phase 2 | Current / Phase 3 | Migration rationale |
| --- | --- | --- | --- | --- |
| Data capture | Scan-IT and Google Forms | Mobile scanner calling REST API | Responsive web UI and future PWA | Preserve SKU and CSV-compatible fields. |
| Data store | Google Sheets tabs | PostgreSQL or MySQL | Supabase PostgreSQL | Relational integrity, RLS, transactions, and portability. |
| Business logic | Google Apps Script | SQL procedures and services | Supabase Edge Functions and database functions | Keep business rules identical while moving ownership to the server. |
| UI | Sheets and Forms | Lightweight web/mobile client | React + Vite + Tailwind/DaisyUI | Role-aware, responsive workflows. |
| Auth | Google Workspace sharing | OAuth/JWT and RBAC | Supabase Auth and RLS | Enforce authorization at the data boundary. |
| Printing | WD-Link 8270 and ESC/POS | Server-side print gateway | PDF/ticket service to be added | Keep printer integration behind a small service. |
| Hosting | Google services | Managed SQL/API | Netlify frontend + Supabase backend | Low operating cost and managed infrastructure. |
| Backup | Drive version history and CSV | Nightly database dumps | Supabase backups plus exports | Maintain portable recovery artifacts. |

### Architectural principles

- **Data first:** UI and automation consume structured records; they do not own business data.
- **Stateless services:** API and edge functions should be horizontally scalable.
- **Loose coupling:** QR generation, printing, reporting, and notifications communicate through stable IDs.
- **Portability:** Table fields use snake_case and retain CSV-compatible names.
- **Server-side integrity:** Inventory changes must be transactional and auditable.
- **Least privilege:** Authenticated users receive only the access required for their role.

## 4. Data Model

### 4.1 Tables

| Table | Purpose |
| --- | --- |
| products | Master list of perfume SKUs. |
| raw_materials | Ingredient catalog and stock. |
| suppliers | Supplier master data. |
| purchases | Raw-material purchase receipts. |
| production_batches | Production batches, formulas, dates, and quantities. |
| inventory | Current stock by product and location. |
| customers | Client master data and classification. |
| sales_orders | Order headers and lifecycle status. |
| order_items | Product lines belonging to an order. |
| payments | Cash, card, and other payment records. |
| deliveries | Dispatch, courier, and tracking records. |
| returns | Returned order items and processing details. |
| employees | Production and sales staff. |
| expenses | Non-product business costs. |
| audit_log | Immutable record of important data changes. |

### 4.2 Canonical product fields

| Field | Type | Key | Description |
| --- | --- | --- | --- |
| product_id | integer / serial | PK | Internal product ID. |
| sku | varchar(20) | UNIQUE | Stable human-readable code, for example `PRF-20ML-001`. |
| name | varchar(100) |  | Arabic and/or Latin product name. |
| volume_ml | integer |  | Bottle volume. |
| price | decimal(10,2) |  | Retail price in MAD. |
| cost_per_unit | decimal(10,2) |  | Calculated unit cost. |
| category | varchar(50) |  | Floral, woody, and similar categories. |
| created_at | timestamp |  | Creation timestamp. |
| updated_at | timestamp |  | Last modification timestamp. |
| qr_payload | json/jsonb |  | Stable QR payload. |

The full relational schema is defined in `supabase/migrations/20241001_init_schema.sql`. New fields must remain compatible with the CSV headers below and must be documented in this file.

### 4.3 Canonical CSV headers

```text
Raw_Materials: material_id, name, unit, cost_per_unit, supplier_id, stock_qty, reorder_level
Suppliers: supplier_id, name, contact_name, phone, email, city, address
Purchases: purchase_id, supplier_id, material_id, quantity, unit_price, total_price, received_at, notes
Products: product_id, sku, name, volume_ml, price, cost_per_unit, category, created_at, updated_at, qr_payload
Production_Batches: batch_id, product_id, quantity_produced, date_started, date_completed, raw_materials_used, operator_id, notes
Inventory: inventory_id, product_id, location, available_qty, reserved_qty, last_updated
Customers: customer_id, first_name, last_name, email, phone, city, address, classification, preferred_courier, created_at, updated_at
Sales_Orders: order_id, customer_id, order_date, status, total_amount, currency, notes, created_at, updated_at
Order_Items: item_id, order_id, product_id, qty, unit_price, line_total, discount_percent, tax_percent, created_at
Payments: payment_id, order_id, payment_date, method, amount, reference, notes
Deliveries: delivery_id, order_id, courier, tracking_number, dispatch_date, expected_delivery, status, notes
Returns: return_id, order_id, product_id, qty, reason, return_date, processed_by, notes
Employees: employee_id, first_name, last_name, role, email, phone, hire_date, status
Expenses: expense_id, category, amount, date_incurred, description, recorded_by
Stock_Init: sku, initial_qty
```

### 4.4 Relationships

```text
suppliers 1---* purchases *---1 raw_materials
products 1---* production_batches
products 1---* inventory
customers 1---* sales_orders 1---* order_items *---1 products
sales_orders 1---* payments
sales_orders 1---1 deliveries
sales_orders 1---* returns *---1 products
employees 1---* production_batches
employees 1---* returns
employees 1---* expenses
```

## 5. Inventory Rules

| Event | Required effect |
| --- | --- |
| Initial stock load | Insert inventory rows at `Warehouse-A` from `Stock_Init`. |
| Production completed | Increase `available_qty`; decrement raw-material stock; record the batch. |
| Order confirmed | Increase `reserved_qty` and decrease `available_qty` for each line. Reject insufficient stock. |
| Order shipped | Complete the reservation, create delivery data, and record the stock movement. |
| Return processed | Increase `available_qty`; reverse reservation when the order is not shipped. |
| Stock take | Reconcile counted quantity and retain an audit trail. |
| Low stock | Compare available quantity with the SKU reorder level and notify the manager once per relevant transition. |

The existing Supabase stock adjustment function is `supabase/functions/adjust_stock/index.ts`. Inventory-changing operations must use the database or edge-function path rather than client-side arithmetic.

## 6. QR and Barcode System

### 6.1 Stable product payload

```json
{
  "sku": "PRF-20ML-001",
  "name": "Jasmine Dream",
  "price": 120.00,
  "volume_ml": 20,
  "date_added": "2024-09-01"
}
```

The payload schema must not change between phases. Add `qr_schema_version` before changing the payload shape. Invoice QR codes may contain an order summary with `order_id`, `total`, `date`, and customer identity as defined by the printing workflow.

### 6.2 Generation and scanning

- Phase 1: render the QR with a Google Sheets `IMAGE` formula and `ENCODEURL`.
- SQL phase: generate PNG/SVG server-side and store a path or binary reference.
- Web phase: render dynamically with a QR component and provide printable output.
- Scan workflow: decode JSON, validate the SKU server-side, then create or update the relevant record.
- Preserve legacy QR images when migration requires historical reprinting.

## 7. Printing

| Document | Required contents |
| --- | --- |
| Product label | SKU, Arabic/Latin name, price, volume, and product QR. |
| Shipping label | Order ID QR, address, courier tracking data. |
| Invoice ticket | Order ID, date, customer, line items, totals, and order QR. |
| Return receipt | Return ID QR, returned items, reason, and `RETURN` label. |

The WD-Link 8270 is a 58 mm thermal printer. Keep ESC/POS commands behind a small print service. Google Cloud Print is deprecated; Phase 1 may produce a PDF for manual printing, while later phases should use a local/server print gateway.

## 8. Automation and Notifications

| Trigger | Action |
| --- | --- |
| Production completed | Atomically update finished goods and raw materials. |
| Sales order confirmed | Reserve inventory and prevent overselling. |
| Order shipped | Move reserved stock through the shipment workflow and create delivery data. |
| Low stock detected | Send email and Telegram notification to the manager. |
| Payment received | Update payment/order status and expose margin reporting. |
| End of day | Generate a sales summary and deliver it to management. |
| Return processed | Restore stock and adjust the order's financial state. |
| Product QR scanned | Validate the SKU and add the product to the invoice/order. |

Telegram credentials must never be committed to source control. Store the bot token and chat ID in deployment secrets. The Phase 1 Apps Script helper uses the Telegram Bot API; the current application should emit the same event from a server-side function.

## 9. Roles and Permissions

| Role | Permissions |
| --- | --- |
| Production Manager | Manage production batches, inventory, and raw materials; approve low-stock actions. |
| Sales / Logistics Officer | Manage customers, orders, deliveries, and invoice generation. |
| Warehouse Staff | View inventory and submit stock adjustments or stock takes. |
| Finance | View payments and expenses; record approved expenses. |
| Admin / Owner | Full management access, users, roles, and audit logs. |

Phase 1 uses Google Workspace sharing. The Supabase implementation uses authenticated users, profiles, role checks, and row-level security. Any new endpoint or table policy must be reviewed against this matrix.

## 10. Dashboard and Reporting

Required metrics:

- Daily sales and monthly revenue/profit.
- Current stock by location and SKU, with low-stock indicators.
- Top-selling products.
- Return ratio.
- Employee production count.
- Courier delivery performance.
- Cash flow from payments versus expenses.

Phase 1 may use Google Data Studio. The current web application should expose aggregated server-side data for KPI cards, tables, and charts. Reporting must not bypass RLS or read secrets in the browser.

## 11. Security, Backups, and Privacy

- Use HTTPS for every deployed surface.
- Keep Supabase service-role credentials server-side only.
- Use RLS for tenant/data access and role-aware application checks for workflows.
- Record important inventory, order, payment, and permission changes in `audit_log`.
- Export portable CSV data regularly and retain database backups according to the deployment plan.
- Store only necessary personal data; never store raw payment card information.
- Test restore procedures periodically rather than relying only on backup existence.

## 12. Migration Path

```text
Phase 1: Google Sheets + Scan-IT + WD-Link
    -> Phase 2: PostgreSQL + API + server-side automation
    -> Phase 3: React web app + mobile PWA + modular ERP services
    -> Phase 4: Optional multi-tenant SaaS
```

Migration rules:

1. Never change SKU or stable ID formats.
2. Export/import according to the canonical CSV headers.
3. Preserve reserve-stock, return, production, and alert behavior exactly.
4. Move business logic from Apps Script to transactions and services, not UI code.
5. Add unit tests for each rule and integration tests for the end-to-end order flow.
6. Keep Sheets view-only after SQL becomes authoritative.

## 13. Current Repository Implementation

- Frontend entry: `src/App.jsx` and `src/main.jsx`.
- Shared styling: `src/index.css` and Tailwind/DaisyUI configuration.
- Authentication hook: `src/hooks/useAuth.js`.
- Supabase client: `src/lib/supabaseClient.js`.
- Database migration: `supabase/migrations/20241001_init_schema.sql`.
- Stock edge function: `supabase/functions/adjust_stock/index.ts`.
- UI modules: products, customers, orders, invoices, dashboard, layout, and shared controls.
- Deployment: Netlify configuration in `netlify.toml`; CI/deployment details are documented in `README.md`.

The browser may request data through Supabase's public client, but authorization and stock mutation remain database/server responsibilities. The UI must not assume that a successful render means an operation was authorized.

## 14. Phase 1 Reference Artifacts

For a spreadsheet-first rollout, create one workbook named `PerfumeERP` with tabs matching the canonical CSV headers. Use data validation for cities and lifecycle statuses. Connect Production, Sales Order, and Return Forms to an Apps Script submit trigger. Use the following operational sequence:

1. Load the `Stock_Init` sheet and reconcile initial quantities.
2. Record and complete a production batch.
3. Confirm a sales order and verify reservations.
4. Generate the invoice ticket and order QR.
5. Ship the order and verify delivery and stock movement.
6. Process a return and verify inventory restoration.
7. Reduce stock below the reorder level and verify both email and Telegram alerts.
8. Export and review the affected rows for migration compatibility.

The original Apps Script implementation described in the project brief is a Phase 1 reference only. Secrets, template IDs, and Telegram IDs are placeholders and must be configured outside source control before use.

## 15. Change Log

| Date | Change | Reason | Impact |
| --- | --- | --- | --- |
| 2024-09-17 | Created the original MAP specification. | Establish a portable ERP source of truth. | Baseline architecture, workflow, and data model. |
| 2024-09-17 | Defined stable QR payload and low-stock rules. | Support QR-driven inventory and alerts. | All implementations must preserve the payload and notification behavior. |
| 2024-09-17 | Documented Sheets, Apps Script, printing, and migration phases. | Provide a concrete low-cost rollout. | Enables Phase 1 and a controlled SQL migration. |
| 2026-09-17 | Added this repository MAP and recorded the Supabase implementation. | Align the original phased specification with the working codebase. | Supabase Postgres/Auth/Storage/RLS and Edge Functions are the current backend authority; future additions must preserve the canonical model and rules. |
