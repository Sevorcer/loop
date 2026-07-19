// ============================================================
// Company Brain — Mock Knowledge Usage
// Sprint 20
//
// Tracks recent knowledge access events.
// Not for analytics — for understanding whether knowledge
// is actually helping operations.
// ============================================================

import type { KnowledgeUsage } from "../types/knowledgeItem";

export const mockKnowledgeUsage: KnowledgeUsage[] = [
  {
    id: "ku-001",
    knowledgeItemId: "ki-001",
    event: "viewed",
    context: "Dispatch — before Technician departure",
    timestamp: "2025-07-18T07:45:00Z",
  },
  {
    id: "ku-002",
    knowledgeItemId: "ki-005",
    event: "referenced",
    context: "Live Operations — E6 fault on active job",
    timestamp: "2025-07-18T10:22:00Z",
  },
  {
    id: "ku-003",
    knowledgeItemId: "ki-002",
    event: "viewed",
    context: "Job prep — commercial site",
    timestamp: "2025-07-18T06:55:00Z",
  },
  {
    id: "ku-004",
    knowledgeItemId: "ki-007",
    event: "referenced",
    context: "Electrical rough-in — 3.5 ton replacement",
    timestamp: "2025-07-17T13:10:00Z",
  },
  {
    id: "ku-005",
    knowledgeItemId: "ki-009",
    event: "viewed",
    context: "Installed Systems — Daikin RX owner follow-up",
    timestamp: "2025-07-17T09:00:00Z",
  },
  {
    id: "ku-006",
    knowledgeItemId: "ki-004",
    event: "referenced",
    context: "Job — HRV install commissioning",
    timestamp: "2025-07-16T14:30:00Z",
  },
  {
    id: "ku-007",
    knowledgeItemId: "ki-001",
    event: "updated",
    context: "Revised pressure test duration requirement",
    timestamp: "2025-04-02T14:30:00Z",
  },
  {
    id: "ku-008",
    knowledgeItemId: "ki-014",
    event: "linked",
    context: "Installed System — multi-zone wiring issue",
    timestamp: "2025-07-15T16:00:00Z",
  },
  {
    id: "ku-009",
    knowledgeItemId: "ki-003",
    event: "viewed",
    context: "Dispatch prep — rooftop unit replacement",
    timestamp: "2025-07-14T08:00:00Z",
  },
  {
    id: "ku-010",
    knowledgeItemId: "ki-006",
    event: "referenced",
    context: "Service call — no heat diagnosis",
    timestamp: "2025-07-13T11:00:00Z",
  },
];
