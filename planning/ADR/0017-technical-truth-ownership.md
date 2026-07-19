# ADR-017 — Technical Truth Ownership

**Status:** Accepted  
**Date:** 2026-07-19  
**Sprint:** 17 (post-merge architectural clarification)  
**Author:** Engineering Team

---

## Context

Sprint 17 introduced **Installed Systems** as a first-class operational domain. The sprint successfully established that technical information should flow through a normalized pipeline rather than being re-entered on every permit, job, or report.

However, during post-sprint review, the team identified a subtlety in the ownership model that needed to be made explicit before future domains built on top of it.

---

## Problem

The initial mental model described the flow as:

```
Equipment Catalog
        ↓
Technical Profile
        ↓
Installed System
```

This model is useful for understanding data flow, but it implies the **catalog creates or owns** the Technical Profile. That is not the right model.

---

## Decision

The correct architectural model is:

```
Equipment Catalog
        │
        │ referenced by
        ▼
Installed System
        │
        │ owns
        ▼
Technical Profile
```

### Equipment Catalog

The **Equipment Catalog** holds canonical manufacturer/model reference data:
- Manufacturer name, model number
- AHRI numbers and efficiency ratings
- Electrical requirements (MCA, MOCP, voltage)
- Refrigerant type and factory charge
- Physical dimensions, weight, sound ratings
- Linked documents (manuals, submittals)

The catalog changes rarely. It contains facts the manufacturer publishes, not facts the company discovers in the field.

### Installed System

The **Installed System** is the customer-specific asset. It is:
- Installed at a specific property
- Created from a sold work order
- The long-lived lifecycle anchor for the customer asset
- The future home of service history, warranty records, repairs, and replacements

Two customers may have the same model number in the catalog. But they do not have the same Installed System.

### Technical Profile

The **Technical Profile** belongs to the Installed System context. It is not a static view of catalog data; it is the growing technical understanding of this specific installed asset.

```
Technical Profile = Catalog Truth + Installed Truth + Verified Truth
```

| Layer | Owner | Changes? |
|-------|-------|----------|
| **Catalog Truth** | Equipment Catalog | Rarely; only when manufacturer data is revised |
| **Installed Truth** | Installed System | Evolves whenever installation details change |
| **Verified Truth** | Field technicians / commissioning | Grows as work is performed |

This model allows the Technical Profile to become richer over time as a system accumulates:
- Accessory installations
- Field configuration details
- Commissioning values
- Service measurements
- Warranty notes
- Replacement component history

---

## Principles Established

### 1. Permits and downstream workflows are consumers of technical truth, not owners of it.

Permits, submittals, service reports, warranty workflows, replacement quotes, and maintenance plans should all **consume** the Technical Profile rather than maintaining separate copies of the same facts.

### 2. Technical truth becomes more valuable over time.

Most field service platforms treat equipment records as static. LOOP treats the Technical Profile as an evolving asset. A system installed yesterday knows less than the same system after two years of commissioning, service, and maintenance.

### 3. The catalog is referenced, never duplicated.

When a Technical Profile references catalog data, it should hold a reference to the catalog entry (via `catalogEntryIds`), not copy the catalog fields. Downstream consumers of exact catalog facts should read them from the catalog, not from derived fields that may become stale.

---

## Consequences

### Positive

- Future domains (Service, Warranty, Company Brain) can consume the Technical Profile as a growing knowledge record rather than re-fetching raw catalog facts.
- Installed Systems become durable long-term asset records, not just install job artifacts.
- Technical truth progresses from shallow (catalog reference only) to deep (catalog + installed + verified) as work is performed.

### Negative

- Displaying Technical Profile information requires joining the profile to catalog entries, not just reading flat fields. This is acceptable complexity given the long-term value.

---

## Future Domain Implication

Sprint 17 may have quietly established the foundation for a future **Asset History** domain. Once Installed Systems accumulate installation, commissioning, service visits, warranty claims, repairs, refrigerant additions, maintenance, photos, and replacements, LOOP transitions from managing jobs to managing **technical assets over time**.

That is strategically valuable and may shape future Service, Company Brain, and Business Intelligence sprints.

---

## References

- Sprint 17 implementation: `src/features/installed-systems/`
- Domain types: `src/features/installed-systems/types/installedSystem.ts`
- Post-sprint review: `planning/Sprints/Sprint-17-review.md`
