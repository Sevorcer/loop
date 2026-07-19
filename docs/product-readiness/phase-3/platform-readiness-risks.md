# Platform Readiness Risks

## Release risk

### Ship blockers

- **Dead-end primary actions in core workspaces** (`/dashboard`, `/properties`, `/customers`, `/vehicle-alerts`) make the product feel broader than it really is.
- **Settings is exposed as primary navigation but is still a placeholder** (`/settings`), which weakens confidence in workspace completeness.
- **Cross-route data truth is inconsistent** because Jobs can change locally while Dashboard, Customers, and Properties remain static.

### Non-blockers

- Missing route constants for `/customers` and `/vehicle-alerts` are fixable without product redesign.
- Loading-state polish can follow after blocker workflows are either implemented or hidden.

## Usability risk

### Ship blockers

- **Users can start but not complete common flows** from obvious entry points such as “New Property”, “New Customer”, “Report Alert”, and dashboard quick actions.
- **Error and empty-edge handling is inconsistent across detail routes**, so failure states do not feel deliberate.

### Non-blockers

- Inline loading boxes are visually weaker than full route skeletons, but they are survivable once the underlying flows are trustworthy.
- Daily Plans placeholder actions are confusing, but they can be downgraded from blocker status if clearly labeled as preview-only.

## Data-trust risk

### Ship blockers

- **Dashboard summaries are hardcoded** and can disagree with underlying route behavior.
- **Customer/property open-job context can drift from Jobs state** after in-session edits or new job creation.

### Non-blockers

- Read-only domains such as Reporting, Inventory, Dispatch, and Installed Systems remain coherent as long as they are treated as preview/demo data rather than source-of-truth operations.

## Navigation / discoverability risk

### Ship blockers

- **Primary navigation over-promises capability** by exposing incomplete Settings and dead-end action surfaces.
- **Dashboard quick actions teach users to click controls that do not work**, which damages discoverability confidence across the whole product.

### Non-blockers

- Route taxonomy itself is understandable: no dead sidebar routes were identified in the current default branch.
- The shared shell, header, and grouping structure are strong foundations once action completion is tightened.

## Bottom line

- **Ship blockers before broader rollout:** dead-end core actions, placeholder Settings, and cross-route data-truth drift.
- **Non-blockers for a narrow preview:** route-constant cleanup, improved loading polish, and standardized shell-level edge-state patterns.
