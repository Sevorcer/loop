# Route Inventory

## Summary

No audited product domain currently clears the bar for **Production-ready**. The app shell is cohesive and most routes are visually substantial, but the product surface is still dominated by local/mock state, read-only workflows, and several dead-end calls to action.

## Top-level routes

| Path | Domain | Status | Purpose summary |
| --- | --- | --- | --- |
| `/` | Entry redirect | Shell-only | Redirects users into the shell at Dashboard. |
| `/dashboard` | Dashboard | Partial | Presents operational metrics, attention items, recent activity, and quick actions. |
| `/jobs` | Jobs | Partial | Main execution workspace for active work, job metrics, and the job board. |
| `/properties` | Properties | Partial | Portfolio and property directory view for serviced locations. |
| `/daily-plans` | Daily Plans | Partial | Morning operations workspace for crew assignment, readiness, and plan activation. |
| `/live-operations` | Live Operations | Partial | Active-day monitoring view for crews, events, and operational health. |
| `/dispatch` | Dispatch | Partial | Scheduling and readiness board for dispatch plans, crew blocks, and recent events. |
| `/inventory` | Inventory | Partial | Material-readiness workspace for warehouse, allocations, and inventory state. |
| `/company-brain` | Company Brain | Partial | Search and browse operational knowledge, SOPs, and troubleshooting content. |
| `/reporting` | Reporting | Partial | Read derived performance intelligence, health indicators, and scorecards. |
| `/installed-systems` | Installed Systems | Partial | View technical identities, catalog matches, and permit-ready system truth. |
| `/customers` | Customers | Partial | Customer directory and account relationship workspace. |
| `/vehicle-alerts` | Vehicle Alerts | Partial | Fleet issue board for installer-reported vehicle problems and follow-up. |
| `/settings` | Settings | Placeholder | Reserved for workspace configuration, but currently only shows placeholder copy. |

## Notable child routes

| Path | Parent domain | Status | Purpose summary |
| --- | --- | --- | --- |
| `/jobs/new` | Jobs | Partial | Creates a new job through the strongest end-to-end input flow in the app. |
| `/jobs/[id]` | Jobs | Partial | Displays job summary, timeline, notes, status actions, and linked installed systems. |
| `/jobs/[id]/edit` | Jobs | Partial | Edits an existing job through the same in-app data model. |
| `/properties/[id]` | Properties | Partial | Shows property context, recent stories, map views, and local site intelligence. |
| `/installed-systems/[id]` | Installed Systems | Partial | Displays technical profile, permit inheritance, catalog references, and history. |
| `/customers/[id]` | Customers | Partial | Displays customer details, account context, related jobs, and related properties. |

## Route status rationale

### Why most routes are **Partial**

The routes are substantial enough to avoid the **Placeholder** or **Shell-only** labels, but they stop short of production readiness because one or more of these conditions are still true:

- the page is primarily read-only
- the page relies on local/mock state rather than durable product workflows
- a primary action is visually prominent but not wired to a complete outcome
- the route explains a domain well but does not yet let users fully operate it

### Why `/settings` is **Placeholder**

`/settings` currently communicates intent only. It does not expose settings structure, sections, or usable configuration flows.

### Why `/` is **Shell-only**

`/` is only a redirect entry point. It does not own product behavior beyond dropping the user into Dashboard.
