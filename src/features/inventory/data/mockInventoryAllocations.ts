import type { InventoryAllocation } from "../types/inventory";

/**
 * Mock inventory allocations for Sprint 18.
 * Each allocation represents a commitment of inventory to a specific job.
 * State reflects current operational progress for each material.
 */
export const mockInventoryAllocations: InventoryAllocation[] = [
  // ----------------------------------------------------------------
  // JOB-1001 — Smith Residence — Mitsubishi Hyper Heat
  // Status: All materials picked and loaded (truck ready)
  // ----------------------------------------------------------------
  {
    id: "alloc-001",
    inventoryItemId: "inv-001",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:30:00Z",
    loadedAt: "2026-07-19T06:45:00Z",
    notes: "Outdoor unit staged and loaded on Install Truck 4",
  },
  {
    id: "alloc-002",
    inventoryItemId: "inv-004",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:35:00Z",
    loadedAt: "2026-07-19T06:45:00Z",
    notes: "Air handler loaded with outdoor unit",
  },
  {
    id: "alloc-003",
    inventoryItemId: "inv-006",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:40:00Z",
    loadedAt: "2026-07-19T06:45:00Z",
  },
  {
    id: "alloc-004",
    inventoryItemId: "inv-007",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:42:00Z",
    loadedAt: "2026-07-19T06:50:00Z",
  },
  {
    id: "alloc-005",
    inventoryItemId: "inv-008",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:45:00Z",
    loadedAt: "2026-07-19T06:50:00Z",
  },
  {
    id: "alloc-006",
    inventoryItemId: "inv-009",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:47:00Z",
    loadedAt: "2026-07-19T06:50:00Z",
  },
  {
    id: "alloc-007",
    inventoryItemId: "inv-011",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:50:00Z",
    loadedAt: "2026-07-19T06:55:00Z",
  },
  {
    id: "alloc-008",
    inventoryItemId: "inv-013",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    quantity: 1,
    state: "loaded",
    allocatedAt: "2026-07-18T14:00:00Z",
    pickedAt: "2026-07-18T16:52:00Z",
    loadedAt: "2026-07-19T06:55:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1009 — Johnson Residence — Mitsubishi Ducted
  // Status: Mostly allocated, but thermostat is backordered (attention needed)
  // ----------------------------------------------------------------
  {
    id: "alloc-009",
    inventoryItemId: "inv-002",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    quantity: 1,
    state: "picked",
    allocatedAt: "2026-07-18T15:00:00Z",
    pickedAt: "2026-07-19T07:10:00Z",
  },
  {
    id: "alloc-010",
    inventoryItemId: "inv-004",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    quantity: 1,
    state: "picked",
    allocatedAt: "2026-07-18T15:00:00Z",
    pickedAt: "2026-07-19T07:15:00Z",
  },
  {
    id: "alloc-011",
    inventoryItemId: "inv-009",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    quantity: 1,
    state: "reserved",
    allocatedAt: "2026-07-18T15:00:00Z",
  },
  {
    id: "alloc-012",
    inventoryItemId: "inv-013",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    quantity: 1,
    state: "reserved",
    allocatedAt: "2026-07-18T15:00:00Z",
  },
  // Note: MHK2 thermostat (inv-005) is backordered — no allocation possible

  // ----------------------------------------------------------------
  // JOB-1015 — Clearwater Building C — Packaged Rooftop
  // Status: Blocked — outdoor unit is backordered
  // ----------------------------------------------------------------
  {
    id: "alloc-013",
    inventoryItemId: "inv-010",
    jobId: "job-015",
    jobNumber: "JOB-1015",
    quantity: 1,
    state: "reserved",
    allocatedAt: "2026-07-18T16:00:00Z",
    notes: "Special-order curb adapter — confirmed received",
  },
  // Note: Carrier RTU (inv-003) is backordered — cannot be allocated
];
