# #34 Inventory — competitor survey + Loop recommendation

| | |
|---|---|
| Audience | Collin (decision) |
| Repo / commit | `github.com/Sevorcer/loop` @ `955fa1a` |
| Live check | Supabase `sygdurkefkasgfefvfcs`, Wed Nov 4, 2026 PT — read-only |
| Scope | Design / research only. No builds, no migrations. |

## Plain-English summary

Other field-service tools treat inventory as **where the part sits** (shop vs truck), **what a job needs**, and **how you buy more**. Service Fusion and ServiceTitan do this inside the product. Housecall Pro and Jobber lean on materials-on-the-job plus a partner (Ply) for real truck stock. Sortly is a strong standalone stock tracker that sits beside an FSM.

**Loop today has the idea of "material readiness" in TypeScript, but no inventory tables in production.** The Inventory page correctly shows empty. The smartest next step is **not** a full ServiceTitan-style warehouse system. Start with a **per-job materials list** (needed → on truck → used), then add shop + truck locations, then purchase orders. That lines up with the separate Dispatch materials lane and keeps office + techs using one checklist.

---

## 1. What Loop has today (live + code)

- Inventory UI lives at `/inventory` (`InventoryScreen`). It asks one question: "Can this work actually happen?"
- Types already model `InventoryItem`, `InventoryAllocation`, `JobMaterialPlan`, and readiness states (`ready` / `attention_needed` / `blocked`). Planned line states include planned → allocated → reserved → picked → loaded → installed/consumed, plus missing/blocked.
- Repository reads `inventory_items`. **Live: that table does not exist** (`to_regclass('public.inventory_items')` is null). Provider falls back to an empty message; sample data was removed on purpose.
- Related money data already imported from Service Fusion and unused by Inventory: **5,875** `job_line_items`, **2,370** `invoices`, **1,966** `payments`. Line items are bill/cost rows, not a stock ledger.
- `crews.truck_name` exists (4 crew rows). No stock is tied to those trucks.
- Bundle C #23 is designing per-job materials (needed / on-truck / used) for Dispatch. Inventory (#34) should own the catalog + locations; materials lists should consume that catalog.

---

## 2. Competitor survey (public docs)

### 2.1 Service Fusion (what Legacy One is leaving)

**Model.** Warehouses = any storage place (building, truck, trailer, room). Sublocations (aisle, shelf, bin, compartment). Techs can get a default warehouse so Worker App pulls deduct from the right place. Product Catalog holds inventory vs non-inventory items, unit price, unit cost, vendor costs. Quantity on hand moves when products are used on jobs/invoices or via Inventory Orders.

**Purchasing.** Purchase Orders (vendor, ship-to, catalog items, unit cost from catalog). Receiving a PO creates an Inventory Order and updates warehouse qty (partial receive supported). Inventory Orders also do standalone adjustments (lost/damaged/expired, including negative qty). Reallocate moves stock between warehouses without a full Inventory Order each time.

**Job costing.** Plus plan: labor + materials + expenses per job for true profit. Inventory Management is also on Plus (or an add-on on Starter).

**Sources.**
- Warehouses: https://servicefusion.zendesk.com/hc/en-us/articles/39882018399373-Creating-an-Inventory-Warehouse
- POs / Inventory Orders: https://servicefusion.zendesk.com/hc/en-us/articles/360032125951-Purchase-Orders-and-Inventory-Orders
- Product catalog / stock levels: https://servicefusion.zendesk.com/hc/en-us/articles/4409646851213-Product-Catalog-and-Service-Catalog-Breakdown
- Feature / Plus positioning: https://www.servicefusion.com/lp/customer-journey

**Takeaway for Loop.** Closest mental model to what the office already knows. Warehouse-includes-truck is the right shape. Don't copy "Inventory Order" naming — it's confusing; prefer Receive / Adjust / Transfer.

### 2.2 ServiceTitan

**Model.** Inventory module across trucks and warehouses with real-time stock by location. Pricebook materials + vendors. Technicians assigned to trucks. Purchasing module is a required foundation for replenishment and job costing.

**Truck replenishment.** Materials used on invoices land on a Materials Used list → generate POs (by vendor or by truck) → Pending / Sent / Received → mark items received → export to QuickBooks when fully received. Transfers and adjustments exist. Replenishment can also use transfers from warehouse to truck.

**Job costing.** Material/PO costs vs job revenue; job-type cost ranges. Accounting export (Intacct / QBD).

**Caveat from their own docs.** Older truck-replenishment path notes they do **not** always track on-hand truck qty in real time — they track what needs restocking from usage. Newer Inventory module claims real-time by location. Implementation is heavy (templates, beginning counts, workshops).

**Sources.**
- Inventory module home: https://help.servicetitan.com/roofing/docs/inventory-module-home
- Truck replenishment overview: https://help.servicetitan.com/docs/truck-inventory-replenishment-overview
- Manage parts / POs: https://help.servicetitan.com/docs/manage-parts-and-purchase-orders
- Podcast / job costing tip: https://www.servicetitan.com/podcasts/mastering-servicetitan/kristy-druding-interview

**Takeaway for Loop.** Best-in-class for large shops; too much process for Loop's first version. Steal: **usage on the job drives replenishment**, PO by vendor, truck as a first-class location.

### 2.3 Housecall Pro

**Model (native).** Materials live on the job as price-book line items. Optional fields: Source, Purchase status, Vendor. Material-on-jobs reporting for qty and which jobs used what. Job costing pulls price-book unit costs + labor/commissions. Native truck/warehouse stock is thin.

**Purchasing (native, HVAC/Electrical/Plumbing plans).** Vendors you manage yourself; PO lifecycle Draft → Issued → Confirmed → Backordered → Partially Received → Received → Completed / Canceled. Can start a PO from a job and pull job materials onto it.

**Truck stock.** Partner **Ply**: syncs HCP price book, manages warehouse + truck stock, deducts by tech location, RFQs / auto-replenishment, estimate pipeline → pick list or draft PO.

**Sources.**
- Material detail tracking: https://help.housecallpro.com/en/articles/7119757-material-inventory-detail-tracking
- Purchase orders: https://help.housecallpro.com/en/articles/16392937-create-and-manage-purchase-orders
- Job costing: https://www.housecallpro.com/features/job-costing/
- Ply + HCP: https://help.housecallpro.com/en/articles/10431432-ply-inventory-management-integration-overview

**Takeaway for Loop.** Proves you can get value from **materials-on-job first**, stock ledger second. Loop should not depend on a third-party inventory product for MVP.

### 2.4 Sortly (stock-first, FSM-adjacent)

**Model.** Visual folders that map to warehouses, trucks, job sites. Items with photos, custom fields, barcode/QR, low-stock and date alerts, offline mobile, check-in/check-out, pick lists.

**Jobs feature.** Create a job → pull items in → update on mobile (allocated / used / returned) → close with a record.

**Purchasing.** Create PO from inventory data, export/send to vendor, mark Received / Partially Received. QuickBooks Online integration.

**Sources.**
- Features: https://www.sortly.com/features/
- Jobs: https://www.sortly.com/features/jobs/
- Purchase orders: https://www.sortly.com/features/purchase-orders/
- Truck inventory guide: https://www.sortly.com/blog/truck-inventory-management/

**Takeaway for Loop.** Excellent UX for techs counting a truck. Weak as a replacement for dispatch/billing. Borrow: barcode later, low-stock alerts, job-scoped item moves.

### 2.5 Jobber (optional fifth)

**Model.** Jobber itself: products/materials on jobs and basic job costing. Full warehouse + truck stock + POs: typically **Ply** (or similar). Ply syncs jobs, materials, users; links POs back to Jobber jobs; truck deduction on use.

**Sources.**
- Ply + Jobber: https://www.getply.com/integrations/jobber/
- What syncs: https://help.getply.com/en/articles/16415707-jobber-ply-what-syncs

**Takeaway for Loop.** Same pattern as HCP: FSM owns the job; inventory partner owns stock. Loop can own both in-house at a smaller scale.

---

## 3. Side-by-side (what matters for Legacy One)

| Capability | Service Fusion | ServiceTitan | Housecall Pro | Sortly | Jobber |
|---|---|---|---|---|---|
| Shop + truck locations | Yes (warehouses) | Yes | Via Ply | Yes (folders) | Via Ply |
| Deduct on job use | Yes | Yes (invoice materials) | Line items; stock via Ply | Job moves | Via Ply |
| Purchase orders | Yes + Inventory Orders | Yes + replenishment | Yes (trade plans) | Yes | Via Ply |
| Job costing | Plus | Strong | Native margins | Weak alone | Basic + Ply costs |
| Fit for Loop MVP | Closest habits | Too heavy | Materials-first OK | Stock UX only | Same as HCP |

---

## 4. Recommendation for Loop's shape

### Concepts (plain language)

1. **Catalog item** — a part/equipment/consumable with SKU, name, unit, sell price, cost, preferred vendor (can seed from SF product lines later).
2. **Location** — Shop (one or more) and **Truck** (one per vehicle / crew truck). Same idea as SF warehouse.
3. **Stock balance** — qty on hand per item per location. Optional reserved qty later.
4. **Job materials list** — for one job: lines with qty needed, state **needed / on-truck / used** (and later returned). This is the Dispatch checklist from #23.
5. **Movement** — receive (PO or adjustment), transfer (shop→truck), consume (on-truck→used on job).
6. **Purchase order** — vendor + lines + receive against a location. Phase 3, not day one.
7. **Job cost snapshot** — sum of used-material cost (+ labor later). Phase 4.

### How it ties to per-job materials (#23)

| Materials lane (#23) | Inventory (#34) |
|---|---|
| Checklist on the job / Dispatch card | Source of truth for "do we have it" and where |
| States: needed → on-truck → used | Movements that update location balances |
| Can start with free-text / ad-hoc lines | Catalog match optional at first, required later |
| Tech marks used in the field | Office sees truck go down and shop need restock |

**Rule of thumb:** a materials line without a catalog link still works for "don't forget the condensate pump." A catalog link is what makes truck stock and job costing honest.

### Phased MVP

| Phase | Ship | Deliberately skip |
|---|---|---|
| **1 — Job materials** | `job_material_lines` (job_id, name, qty_needed, qty_on_truck, qty_used, optional catalog_id, notes). UI on job + Dispatch. No stock math. | Warehouses, POs, barcodes |
| **2 — Locations + balances** | `inventory_items`, `inventory_locations` (shop/truck), `inventory_balances`. Transfer shop→truck when marking on-truck. Consume when marking used. | Auto-reorder, serials |
| **3 — Purchasing** | Vendors + POs + receive into a location. Low-stock flag on balances. | Multi-vendor RFQ, accounting export |
| **4 — Job costing** | Cost from used lines on the job; office report. Optional link from `job_line_items` sell price. | Full QuickBooks inventory sync |

### What not to copy

- Service Fusion's "Inventory Order" name.
- ServiceTitan's full implementation workshops before any UI value.
- Depending on Ply/Sortly as the system of record while Loop already owns jobs.

### Seed path from existing SF money data

`job_line_items` (5,875) are a hint at what was sold/used historically, not on-hand stock. Use them later to suggest catalog names and typical job kits — not as opening balances. Opening truck/shop counts should be a short physical count once Phase 2 lands.

---

## 5. Decision ask for Collin

1. Confirm Phase 1 = job materials checklist only (no stock counts yet).
2. Confirm trucks = locations (reuse `crews.truck_name` / vehicle list) rather than inventing a second truck object.
3. Say whether office wants POs inside Loop in the first 90 days, or paper/email POs until Phase 3.
