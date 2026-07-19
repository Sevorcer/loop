# Authorization Matrix — Project Portal

**Version:** 1.0  
**Sprint:** 22  
**Status:** Draft — pending approval  
**Last updated:** 2026-07-19

This matrix defines which roles can access which resources, what actions they may perform, and how conflicts and precedence are resolved when a user holds multiple roles or memberships.

For role definitions and the multi-tenant model, see [`sprint-22-foundation.md`](./sprint-22-foundation.md).

---

## Role Definitions

| Role | Description | Scope |
|---|---|---|
| **Homeowner** | Residential customer with a single active project | Single project |
| **General Contractor (GC)** | Trade partner coordinating multiple active projects | Multi-project, org-scoped |
| **Builder / Developer** | Developer or builder managing a portfolio of projects | Portfolio, org-scoped |
| **Property Manager** | Long-term owner managing installed systems and service history | Multi-property, org-scoped |
| **Office** *(future)* | Internal staff — reserved; not exposed in Sprint 22 | Org-wide (internal) |
| **Internal Admin** *(future)* | LOOP staff — reserved; not exposed in Sprint 22 | Platform-wide (internal) |

---

## Resource-Level Visibility

`✓` = visible | `—` = not visible | `(future)` = deferred scope

| Resource | Homeowner | GC | Builder / Developer | Property Manager |
|---|---|---|---|---|
| Project overview | ✓ | ✓ | ✓ | ✓ |
| Timeline (milestones) | ✓ | ✓ | ✓ | — |
| Documents (customer-facing) | ✓ | ✓ | ✓ | ✓ |
| Photos | ✓ (if enabled) | ✓ (if enabled) | ✓ (if enabled) | — |
| Approved change orders | ✓ | ✓ | ✓ | — |
| Upcoming appointments | ✓ | ✓ | ✓ | — |
| Contact team | ✓ | ✓ | ✓ | ✓ |
| Milestone completion details | — | ✓ | ✓ | — |
| Inspection status | — | ✓ | ✓ | — |
| Portfolio / multi-project view | — | ✓ | ✓ | ✓ |
| Installed equipment | — | — | — | ✓ |
| Warranty records | ✓ | — | — | ✓ |
| Maintenance records | — | — | — | ✓ |
| Service history | — | — | — | ✓ |
| Internal notes | — | — | — | — |
| Crew assignments | — | — | — | — |
| Crew performance | — | — | — | — |
| Material shortages | — | — | — | — |
| Operational blockers | — | — | — | — |
| Payroll / financials | — | — | — | — |
| Scheduling conflicts (internal) | — | — | — | — |

---

## Action Permissions

| Action | Homeowner | GC | Builder / Developer | Property Manager |
|---|---|---|---|---|
| View project overview | ✓ | ✓ | ✓ | ✓ |
| View timeline | ✓ | ✓ | ✓ | — |
| View documents | ✓ | ✓ | ✓ | ✓ |
| Download documents | ✓ | ✓ | ✓ | ✓ |
| View photos | ✓ (if enabled) | ✓ (if enabled) | ✓ (if enabled) | — |
| Acknowledge change order | ✓ | — | — | — |
| Add comment | (future) | (future) | (future) | (future) |
| Submit service request | (future) | — | — | (future) |
| View portfolio summary | — | ✓ | ✓ | ✓ |
| Export documents | ✓ | ✓ | ✓ | ✓ |
| Manage invitations | — | — | — | — |
| Edit project data | — | — | — | — |

> **Rule:** The portal is read-only. No external role may create, edit, or delete operational data.

---

## Project Scope Rules

| Role | Single-project access | Multi-project access | Portfolio / org-wide |
|---|---|---|---|
| Homeowner | ✓ | — | — |
| GC | ✓ | ✓ (org-scoped) | — |
| Builder / Developer | ✓ | ✓ (org-scoped) | ✓ (portfolio view) |
| Property Manager | ✓ | ✓ (org-scoped) | ✓ (property portfolio) |

Multi-project access is scoped to **the user's organization membership**. A user cannot see projects in an organization they are not a member of.

---

## Deny Rules — Internal-Only Artifacts

The following artifact types must **never** be returned to any external role, regardless of permission evaluation outcome:

| Artifact | Reason |
|---|---|
| Internal notes | Operational commentary not suitable for external stakeholders |
| Draft documents (unpublished) | Not approved for external visibility |
| Internal-tagged documents | Flagged by staff as internal-only |
| Crew assignments | Operational detail not relevant to external users |
| Technician comments | Internal operational communication |
| Change order in draft/pending | Only approved change orders are visible |
| Profitability data | Confidential company financial information |
| Payroll data | Confidential personnel information |
| Operational blockers | Internal escalation tracking |

> **Enforcement:** Deny rules are applied server-side and are not configurable by organization admins or portal users.

---

## Precedence and Conflict Rules — Multi-Role Users

When a user holds more than one role within the same organization, the following rules apply:

### Rule 1: Resource Visibility — Additive

A user sees the **union** of resources their roles permit.

> *Example: A user with both GC and Builder/Developer roles can see milestone completion details (GC entitlement) and the portfolio view (Builder entitlement).*

### Rule 2: Document Visibility — Most Restrictive

When role visibility rules conflict on a specific document, the **most restrictive rule wins**.

> *Example: If GC role allows a document type but the Homeowner rule restricts it, and the user holds both roles, the document is not shown unless the GC entitlement explicitly grants it.*

### Rule 3: Organization Boundary — Always Enforced

Additive permissions never cross organization boundaries. A user in Org A with GC role cannot see projects in Org B, even if they are also a GC in Org B — each organization's access is evaluated independently.

### Rule 4: No Internal Permission Inheritance

External roles can never accumulate permissions that approach the Office or Internal Admin tiers, regardless of how many roles are stacked.

### Role Conflict Resolution Order

```
1. Evaluate organization membership (tenancy boundary)
2. Resolve applicable roles for this organization
3. Apply deny rules (hard blocks — highest precedence)
4. Apply additive resource visibility (union)
5. Apply most-restrictive document rule where conflict exists
6. Return permission set
```

---

## Tenancy Boundary Enforcement

| Rule | Description |
|---|---|
| TB-1 | A portal user may belong to multiple organizations. Each organization's access is evaluated independently. |
| TB-2 | A project belongs to exactly one organization. A user must be a member of that organization to access its projects. |
| TB-3 | Invitation revocation immediately terminates all project access within that organization. |
| TB-4 | Organization membership revocation cascades to all project access within that organization. |
| TB-5 | Portal user sessions are scoped to a single active organization context at a time. |
| TB-6 | No cross-organization data may appear in any portal response, regardless of query parameters. |

---

## Concrete Examples

### Example A — User with GC + Builder Roles in the Same Organization

**Scenario:** Alex is a member of Orion Builders LLC. Within that organization, Alex holds both the **General Contractor** and **Builder / Developer** roles.

**Resolution:**

- Resource visibility = union of GC + Builder entitlements
- Alex can see milestone completion details (GC), portfolio dashboard (Builder), and inspection status (GC)
- Document visibility defaults to most restrictive applicable rule
- Draft documents remain hidden (deny rule)
- All access is strictly scoped to Orion Builders LLC projects

**Effective permissions:** GC ∪ Builder, within Orion Builders LLC, deny rules applied

---

### Example B — User in Two Organizations with Different Roles

**Scenario:** Jordan is a **Homeowner** in SunState HVAC (single project, residential) and a **GC** in Metro Construction Group (multiple active projects).

**Resolution:**

- SunState HVAC context: Homeowner permissions only — single project, no multi-project view
- Metro Construction Group context: GC permissions only — multi-project, inspection status, coordination schedule
- The two organizations are evaluated independently; SunState projects are not visible in the Metro Construction context and vice versa
- Jordan switches organization context explicitly — no blending of org data

**Effective permissions:** Homeowner within SunState HVAC; GC within Metro Construction Group — evaluated separately.

---

### Example C — Revoked Organization Membership

**Scenario:** Taylor was a **Property Manager** in Summit Properties Inc. The organization admin revoked Taylor's membership.

**Resolution:**

1. Membership revocation is applied immediately.
2. All downstream project access within Summit Properties Inc. is terminated.
3. Taylor's active session for Summit Properties Inc. is invalidated.
4. Taylor cannot re-authenticate to Summit Properties Inc. without a new invitation.
5. Taylor's access to **other organizations** is unaffected.
6. The revocation event is recorded in the audit log with timestamp and actor.

**Effective permissions:** None within Summit Properties Inc.; other org memberships unchanged.

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | Can an organization admin grant or restrict individual resource visibility, or is it role-fixed? | Product | Open |
| OQ-2 | Does the portal require explicit per-project invite beyond org membership for GC/Builder roles? | Architecture | Open |
| OQ-3 | Should a revoked user receive a notification email, or is silent revocation acceptable? | Product | Open |
| OQ-4 | What is the grace period (if any) after invitation expiry before access terminates? | Engineering | Open |
| OQ-5 | Are the Office and Internal Admin roles in scope for Sprint 23, or later? | Product | Open |
