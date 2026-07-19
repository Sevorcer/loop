// ============================================================
// Company Brain — Mock Knowledge Relationships
// Sprint 20
//
// Each relationship connects a KnowledgeItem to an entity in
// another operational domain. Company Brain references these
// domains — it does not own their data.
// ============================================================

import type { KnowledgeRelationship } from "../types/knowledgeItem";

export const mockKnowledgeRelationships: KnowledgeRelationship[] = [
  // ki-001 — Mitsubishi Startup Checklist
  {
    id: "kr-001",
    knowledgeItemId: "ki-001",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-mitsubishi",
    relatedEntityLabel: "Mitsubishi Electric",
    relationshipType: "references",
  },
  {
    id: "kr-002",
    knowledgeItemId: "ki-001",
    relatedDomain: "equipment",
    relatedEntityId: "eq-mxz-series",
    relatedEntityLabel: "Mitsubishi MXZ Multi-Zone Series",
    relationshipType: "required_for",
  },
  {
    id: "kr-003",
    knowledgeItemId: "ki-001",
    relatedDomain: "jobs",
    relatedEntityId: "job-type-mini-split-install",
    relatedEntityLabel: "Mini-Split Installation",
    relationshipType: "required_for",
  },

  // ki-002 — Job Site Safety Checklist
  {
    id: "kr-004",
    knowledgeItemId: "ki-002",
    relatedDomain: "jobs",
    relatedEntityId: "job-type-all",
    relatedEntityLabel: "All Job Types",
    relationshipType: "required_for",
  },

  // ki-003 — Curb Adapter Installation
  {
    id: "kr-005",
    knowledgeItemId: "ki-003",
    relatedDomain: "inventory",
    relatedEntityId: "inv-curb-adapter",
    relatedEntityLabel: "Curb Adapter Kit",
    relationshipType: "references",
  },
  {
    id: "kr-006",
    knowledgeItemId: "ki-003",
    relatedDomain: "jobs",
    relatedEntityId: "job-type-rtu-replacement",
    relatedEntityLabel: "RTU Replacement",
    relationshipType: "required_for",
  },

  // ki-004 — HRV Commissioning
  {
    id: "kr-007",
    knowledgeItemId: "ki-004",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-fantech",
    relatedEntityLabel: "Fantech",
    relationshipType: "references",
  },
  {
    id: "kr-008",
    knowledgeItemId: "ki-004",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-lifebreath",
    relatedEntityLabel: "Lifebreath",
    relationshipType: "references",
  },
  {
    id: "kr-009",
    knowledgeItemId: "ki-004",
    relatedDomain: "equipment",
    relatedEntityId: "eq-hrv",
    relatedEntityLabel: "HRV / ERV Units",
    relationshipType: "required_for",
  },

  // ki-005 — Troubleshooting E1/E6
  {
    id: "kr-010",
    knowledgeItemId: "ki-005",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-mitsubishi",
    relatedEntityLabel: "Mitsubishi Electric",
    relationshipType: "references",
  },
  {
    id: "kr-011",
    knowledgeItemId: "ki-005",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-daikin",
    relatedEntityLabel: "Daikin",
    relationshipType: "references",
  },
  {
    id: "kr-012",
    knowledgeItemId: "ki-005",
    relatedDomain: "installed_systems",
    relatedEntityId: "is-mini-split-type",
    relatedEntityLabel: "Mini-Split Installed Systems",
    relationshipType: "recommended_for",
  },

  // ki-007 — Breaker Sizing Guide
  {
    id: "kr-013",
    knowledgeItemId: "ki-007",
    relatedDomain: "equipment",
    relatedEntityId: "eq-condensing-units",
    relatedEntityLabel: "Condensing Units (All)",
    relationshipType: "references",
  },
  {
    id: "kr-014",
    knowledgeItemId: "ki-007",
    relatedDomain: "inventory",
    relatedEntityId: "inv-electrical",
    relatedEntityLabel: "Electrical Materials",
    relationshipType: "references",
  },

  // ki-009 — Daikin Service Bulletin
  {
    id: "kr-015",
    knowledgeItemId: "ki-009",
    relatedDomain: "manufacturers",
    relatedEntityId: "mfg-daikin",
    relatedEntityLabel: "Daikin",
    relationshipType: "references",
  },
  {
    id: "kr-016",
    knowledgeItemId: "ki-009",
    relatedDomain: "installed_systems",
    relatedEntityId: "is-daikin-rx-2022-2023",
    relatedEntityLabel: "Daikin RX Series (2022–2023)",
    relationshipType: "references",
  },

  // ki-014 — Multi-Zone Wiring Lessons Learned
  {
    id: "kr-017",
    knowledgeItemId: "ki-014",
    relatedDomain: "equipment",
    relatedEntityId: "eq-multi-zone",
    relatedEntityLabel: "Multi-Zone Mini-Split Systems",
    relationshipType: "references",
  },
];
