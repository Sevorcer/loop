# Sprint 22 — Project Portal Foundation (v22.0)

## Domain

**Project Portal**

## Owned Truth

**Project Transparency**

The Project Portal owns the external representation of a project lifecycle, providing customers, general contractors, builders, and property managers with secure, role-appropriate visibility into project progress without exposing internal operational data.

> Internal domains execute the work. The Project Portal communicates the work.

---

## Sprint Goal

Design the foundation for LOOP's external experience by defining:

- Project Portal architecture
- Role-based user experiences
- Security model
- Event contracts
- UI prototype
- Integration boundaries

> No production integrations are implemented during this sprint.

---

## Why This Matters

Customers and general contractors repeatedly call for routine updates:

- Has my equipment arrived?
- When are you coming?
- Has inspection passed?
- When will the job be finished?
- Did my change order get approved?

Each call consumes office time. The Project Portal enables secure self-service access to project status, reducing administrative overhead and improving customer confidence.

---

## Product Vision

The Project Portal is the digital front door for every project. Customers, builders, and GCs receive secure access to monitor progress without contacting the office.

---

## Product Principles

1. External users should not need to call the office for routine project updates.
2. Every stakeholder sees only information relevant to their role.
3. The portal never owns operational data; it reflects trusted data from internal domains.
4. Internal workflows remain isolated from customer-facing experiences.
5. The portal is a **projection**, not a system of record.

---

## Core Screens (MVP Foundation)

### 1. Project Overview

Displays:

- Project status
- Completion percentage
- Estimated completion date
- Next milestone
- Assigned project manager
- Last updated timestamp

### 2. Timeline

Milestones:

- Estimate Approved
- Permit Submitted
- Equipment Ordered
- Materials Received
- Installation Scheduled
- Rough-In Complete
- Inspection Passed
- Startup Complete
- Final Walkthrough
- Warranty Registered

### 3. Documents

Customer-facing documents only (permission-filtered):

- Proposal
- Signed agreement
- Manuals
- Warranty
- Inspection documents
- Photos (when enabled)
- Maintenance recommendations

### 4. Contact Team

- Project Manager
- Office
- Sales Representative
- Emergency contacts
- Preferred communication method

---

## Role-Based Experience (First-Class Architecture)

### Homeowner

**Can view:**

- Project overview
- Timeline
- Upcoming appointments
- Photos (when enabled)
- Documents
- Warranties
- Approved change orders
- Contact information

**Cannot view:**

- Internal notes
- Scheduling discussions
- Crew assignments
- Material shortages
- Operational blockers

### General Contractor

**Can additionally view (beyond Homeowner):**

- Milestone completion details
- Inspection status
- Coordination schedule
- Project readiness
- Approved change orders
- Multiple active projects

### Builder / Developer

Portfolio-oriented view across many projects:

- Multiple developments
- Project completion percentages
- Upcoming milestones
- Delays
- Inspection pipeline
- Portfolio dashboard

### Property Manager

Long-term ownership and service visibility:

- Installed equipment
- Warranty information
- Maintenance records
- Service history
- Future service requests (deferred)

---

## Architecture Hardening

### 1. Role Precedence

A user may belong to multiple organizations and hold multiple roles. Permission evaluation follows **least-privilege by default**, while allowing additive capabilities where appropriate.

Defined roles:

| Role | Tier |
|---|---|
| Homeowner | External — single-project |
| General Contractor | External — multi-project |
| Builder / Developer | External — portfolio |
| Property Manager | External — service-history |
| Office | Internal — future |
| Internal Admin | Internal — future |

If a user is both GC and Builder:

- Union of permitted project views
- Most restrictive document visibility applies
- Organization boundaries always enforced
- No internal permissions inherited

Role resolution occurs **before** authorization checks. See [`authorization-matrix.md`](./authorization-matrix.md) for the full matrix.

---

### 2. Multi-Tenant Model

The portal is fully tenant-aware:

```
Organization
  └── Projects
       └── Timeline
       └── Documents
       └── Photos
       └── Events
  └── Users
  └── Invitations
       └── Portal User
            └── Role
            └── Organization membership
            └── Project access
```

Tenancy rules:

- Organizations own invitations.
- Projects never directly own users.
- Removing an organization membership revokes all downstream project access.
- A user may belong to multiple organizations with different roles in each.

---

### 3. Event Contract Standard

The Project Portal **never edits** project data. It subscribes to canonical events emitted by operational domains.

All published events follow this envelope:

```json
{
  "event_id": "string",
  "event_version": "string",
  "event_type": "string",
  "occurred_at": "ISO-8601 timestamp",
  "source_domain": "string",
  "aggregate_id": "string",
  "idempotency_key": "string",
  "payload": {}
}
```

Required metadata fields: `event_version`, `occurred_at`, `source_domain`, `idempotency_key`.

This supports replay, versioning, and backward compatibility.

Canonical event types consumed by the portal:

| Event Type | Source Domain |
|---|---|
| `milestone.completed` | Jobs |
| `inspection.scheduled` | Jobs |
| `inspection.completed` | Jobs |
| `appointment.scheduled` | Dispatch |
| `appointment.updated` | Dispatch |
| `crew.dispatched` | Dispatch |
| `crew.arrived` | Dispatch |
| `installation.completed` | Jobs |
| `startup.completed` | Jobs |
| `change_order.approved` | Change Orders |
| `document.published` | Documents |
| `photo.uploaded` | Photos |

See [`event-contract-spec.md`](./event-contract-spec.md) for the full specification.

---

### 4. Freshness SLA

Portal data is eventually consistent.

| Metric | Target |
|---|---|
| P95 update latency | < 5 minutes |

UI requirements:

- Display "Last synchronized X minutes ago" timestamp on every page.
- If SLA is exceeded, display a stale-data banner.
- Continue serving last known good state — never display partial updates.
- Banner clears automatically when freshness is restored.

---

### 5. Audit Policy

Every external interaction is immutable and auditable.

Tracked events:

| Interaction | Tracked |
|---|---|
| Login | ✓ |
| Logout | ✓ |
| Invitation accepted | ✓ |
| Document viewed | ✓ |
| Photo viewed | ✓ |
| File downloaded | ✓ |
| Change order acknowledged | ✓ |

Retention policy:

- Default retention: **7 years**
- Export available to organization administrators
- Read-only storage — no record deletion by users
- Audit log is separate from application state

---

### 6. Error-State UX

The portal must handle failure states gracefully. Full catalog in [`error-state-catalog.md`](./error-state-catalog.md).

| State | User-Facing Message | Primary CTA |
|---|---|---|
| Unauthorized | "You don't have access to this project." | Contact contractor |
| Expired Invite | "Your invitation has expired." | Request new invite |
| Revoked Access | "Access has been removed by your contractor." | Contact contractor |
| Missing Project | "This project no longer exists or has been archived." | Return to dashboard |
| Stale Feed | "Information may be outdated. Last synchronized 18 minutes ago." | Refresh |
| Service Unavailable | "LOOP is temporarily unavailable. We're working on it." | Try again |

---

### 7. MVP Launch Gates

Sprint 22 is **complete only when all gates pass**. Full checklist in [`mvp-launch-gates-checklist.md`](./mvp-launch-gates-checklist.md).

| Gate | Description |
|---|---|
| Role leakage tests = 0 | No cross-role data exposure |
| Org isolation verified | Tenant boundary enforced in all paths |
| Document visibility validated | Permission filters applied correctly |
| Event schema finalized | All event types defined and versioned |
| Authorization matrix approved | Matrix reviewed and signed off |
| Audit logging operational | All tracked events emit correctly |
| Mock adapters implemented | All event adapters wired to mock data |
| Portal navigation complete | All MVP screens reachable |
| Mobile experience validated | Responsive layout verified |
| Accessibility review completed | WCAG 2.1 AA reviewed |
| P95 freshness < 5 min (mock) | SLA met in mock pipeline |
| All error states demonstrated | Each error state rendered and tested |

---

## Domain Boundaries

The Project Portal does **not** own project data. It consumes information from existing operational domains.

| Domain | Data Shared with Portal |
|---|---|
| Jobs | Project status |
| Daily Plans | Upcoming visits |
| Dispatch | Scheduled work |
| Reporting | Completion metrics (optional) |
| Installed Systems | Equipment information |
| Documents | Customer-facing documents |
| Photos | Progress images |
| Change Orders | Approved changes |

### Forbidden Visibility

The portal must **never** surface:

- Internal notes
- Crew performance
- Payroll
- Material shortages
- Operational blockers
- Scheduling conflicts
- Internal conversations
- Profitability
- Technician comments
- Any confidential company information

---

## Communication Policy

### In-Portal Channels (MVP)

- Timeline
- Documents
- Photos (when enabled)
- Project status
- Appointments
- Progress updates

### Notification Triggers (MVP — outbound only)

- Appointment reminder
- Inspection scheduled
- Project completed
- Change order approved
- Warranty available

### Deferred Channels

- Email delivery
- SMS
- Push notifications
- In-app notifications
- Webhook integrations

---

## MVP Scope

### Build in Sprint 22

- Project Overview screen
- Timeline screen
- Documents screen
- Contact Team screen
- Role gating
- Mock event adapters
- Security architecture
- Navigation flow

### Deferred to Future Sprints

- Photos
- Notifications
- Live integrations
- Messaging
- Warranty management workflows
- Customer comments
- Service request submission

---

## Deliverables

- [ ] Project Charter
- [ ] Product Requirements Document (PRD)
- [ ] Domain Model
- [ ] User Roles & Permissions Matrix
- [ ] Screen Wireframes
- [ ] Navigation Flow
- [ ] Data Mapping Matrix
- [ ] API Contract Outline
- [ ] Mobile Experience Guidelines
- [ ] Design Tokens & UI Components (Atlas integration)
- [ ] Authorization Matrix → [`authorization-matrix.md`](./authorization-matrix.md)
- [ ] Event Contract Spec → [`event-contract-spec.md`](./event-contract-spec.md)
- [ ] Error-State Catalog → [`error-state-catalog.md`](./error-state-catalog.md)
- [ ] Audit Logging Policy
- [ ] MVP Launch Gates Checklist → [`mvp-launch-gates-checklist.md`](./mvp-launch-gates-checklist.md)

---

## Success Metrics

- Reduced inbound status-update calls to office
- Increased customer confidence and transparency scores
- Improved GC and builder coordination efficiency
- Premium post-sale customer experience
- Reusable external architecture for future domains

---

## Definition of Done

- [ ] Project Portal architecture approved
- [ ] Domain boundaries documented
- [ ] Role matrix completed
- [ ] Security model documented
- [ ] Authorization model defined
- [ ] Event contracts specified
- [ ] Freshness SLA documented
- [ ] Screen wireframes completed
- [ ] Navigation flow approved
- [ ] Mock adapters implemented
- [ ] Mobile experience defined
- [ ] API contracts outlined
- [ ] Accessibility validation completed
- [ ] All MVP launch gates satisfied

---

## Architectural Outcome

When Sprint 22 is complete, LOOP has a production-ready foundation for external project transparency.

Operational domains (Jobs, Dispatch, Daily Plans, Installed Systems, Documents, Reporting, Change Orders) remain systems of record. The Project Portal is a secure, role-aware, read-only projection tailored to external stakeholders.

This architecture scales to future external personas — vendors, inspectors, partners, API consumers — without duplicating business logic or exposing internal workflows.

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | What is the invitation expiry TTL? (24h, 48h, 7d?) | Product | Open |
| OQ-2 | Does the GC role require explicit per-project opt-in, or does org membership grant all projects? | Architecture | Open |
| OQ-3 | Are photos a Homeowner entitlement by default, or opt-in per project by the contractor? | Product | Open |
| OQ-4 | Does the portal need its own auth provider, or does it extend LOOP's existing auth? | Engineering | Open |
| OQ-5 | What is the mock pipeline's event emission interval for freshness SLA testing? | Engineering | Open |
| OQ-6 | Should the portal support read-only API tokens for Builder/Developer portfolio integrations in MVP? | Product | Open |
