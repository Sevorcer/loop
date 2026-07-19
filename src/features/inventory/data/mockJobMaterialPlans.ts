import type { JobMaterialPlan } from "../types/inventory";

/**
 * Mock job material plans for Sprint 18.
 * One plan per active install job, showing three different readiness states.
 *
 * JOB-1001 — Ready (truck loaded, crew can roll)
 * JOB-1009 — Attention Needed (thermostat backordered, truck not yet loaded)
 * JOB-1015 — Blocked (outdoor unit backordered, cannot proceed)
 */
export const mockJobMaterialPlans: JobMaterialPlan[] = [
  // ----------------------------------------------------------------
  // JOB-1001 — Smith Residence — Mitsubishi Hyper Heat
  // Readiness: READY — all items picked and loaded
  // ----------------------------------------------------------------
  {
    id: "plan-job-001",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    customerName: "John Smith",
    propertyName: "Smith Residence",
    scheduledFor: "2026-07-21",
    readinessState: "ready",
    generatedAt: "2026-07-18T14:00:00Z",
    lastUpdated: "2026-07-19T06:55:00Z",
    items: [
      {
        id: "item-001-1",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-001",
        itemName: "Mitsubishi MXZ-SM42NAMHZ2-U1 Outdoor Unit",
        category: "Equipment",
        quantityRequired: 1,
        allocationId: "alloc-001",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-2",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-004",
        itemName: "Mitsubishi SVZ-KP36NA Air Handler",
        category: "Equipment",
        quantityRequired: 1,
        allocationId: "alloc-002",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-3",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-006",
        itemName: "Surge Protector — 120V",
        category: "Accessory",
        quantityRequired: 1,
        allocationId: "alloc-003",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-4",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-007",
        itemName: "Line Set 3/8\" × 7/8\" — 50 ft",
        category: "Material",
        quantityRequired: 1,
        allocationId: "alloc-004",
        state: "loaded",
        isSpecialOrder: false,
        notes: "38 ft estimate from site survey; 50 ft kit accommodates run",
      },
      {
        id: "item-001-5",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-008",
        itemName: "Equipment Pad 26\" × 26\"",
        category: "Material",
        quantityRequired: 1,
        allocationId: "alloc-005",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-6",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-009",
        itemName: "Disconnect Switch — 60A",
        category: "Part",
        quantityRequired: 1,
        allocationId: "alloc-006",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-7",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-011",
        itemName: "R-410A Refrigerant — 25 lb",
        category: "Consumable",
        quantityRequired: 1,
        allocationId: "alloc-007",
        state: "loaded",
        isSpecialOrder: false,
      },
      {
        id: "item-001-8",
        materialPlanId: "plan-job-001",
        inventoryItemId: "inv-013",
        itemName: "Liquid-tight Flex Conduit — 12 ft",
        category: "Material",
        quantityRequired: 1,
        allocationId: "alloc-008",
        state: "loaded",
        isSpecialOrder: false,
      },
    ],
  },

  // ----------------------------------------------------------------
  // JOB-1009 — Johnson Residence — Mitsubishi Ducted
  // Readiness: ATTENTION NEEDED — thermostat is backordered
  // ----------------------------------------------------------------
  {
    id: "plan-job-009",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    customerName: "Mike Johnson",
    propertyName: "Johnson Residence",
    scheduledFor: "2026-07-19",
    readinessState: "attention_needed",
    generatedAt: "2026-07-18T15:00:00Z",
    lastUpdated: "2026-07-19T07:15:00Z",
    items: [
      {
        id: "item-009-1",
        materialPlanId: "plan-job-009",
        inventoryItemId: "inv-002",
        itemName: "Mitsubishi SUZ-KA36NAHZ Outdoor Unit",
        category: "Equipment",
        quantityRequired: 1,
        allocationId: "alloc-009",
        state: "picked",
        isSpecialOrder: false,
      },
      {
        id: "item-009-2",
        materialPlanId: "plan-job-009",
        inventoryItemId: "inv-004",
        itemName: "Mitsubishi SVZ-KP36NA Air Handler",
        category: "Equipment",
        quantityRequired: 1,
        allocationId: "alloc-010",
        state: "picked",
        isSpecialOrder: false,
      },
      {
        id: "item-009-3",
        materialPlanId: "plan-job-009",
        inventoryItemId: "inv-005",
        itemName: "Mitsubishi MHK2 Thermostat Adapter",
        category: "Accessory",
        quantityRequired: 1,
        state: "missing",
        isSpecialOrder: false,
        notes: "Backordered — expected 2026-07-22. Crew can proceed but thermostat install deferred.",
      },
      {
        id: "item-009-4",
        materialPlanId: "plan-job-009",
        inventoryItemId: "inv-009",
        itemName: "Disconnect Switch — 60A",
        category: "Part",
        quantityRequired: 1,
        allocationId: "alloc-011",
        state: "reserved",
        isSpecialOrder: false,
      },
      {
        id: "item-009-5",
        materialPlanId: "plan-job-009",
        inventoryItemId: "inv-013",
        itemName: "Liquid-tight Flex Conduit — 12 ft",
        category: "Material",
        quantityRequired: 1,
        allocationId: "alloc-012",
        state: "reserved",
        isSpecialOrder: false,
      },
    ],
  },

  // ----------------------------------------------------------------
  // JOB-1015 — Clearwater Building C — Packaged Rooftop
  // Readiness: BLOCKED — outdoor unit backordered
  // ----------------------------------------------------------------
  {
    id: "plan-job-015",
    jobId: "job-015",
    jobNumber: "JOB-1015",
    customerName: "Clearwater Office Park",
    propertyName: "Clearwater Building C",
    scheduledFor: "2026-07-20",
    readinessState: "blocked",
    generatedAt: "2026-07-18T16:00:00Z",
    lastUpdated: "2026-07-18T16:00:00Z",
    items: [
      {
        id: "item-015-1",
        materialPlanId: "plan-job-015",
        inventoryItemId: "inv-003",
        itemName: "Carrier 48,000 BTU Packaged Rooftop HP",
        category: "Equipment",
        quantityRequired: 1,
        state: "blocked",
        isSpecialOrder: false,
        notes: "Backordered — expected 2026-07-28. Job cannot proceed without rooftop unit.",
      },
      {
        id: "item-015-2",
        materialPlanId: "plan-job-015",
        inventoryItemId: "inv-010",
        itemName: "Roof Curb Adapter — 48\" RTU",
        category: "Accessory",
        quantityRequired: 1,
        allocationId: "alloc-013",
        state: "reserved",
        isSpecialOrder: true,
        notes: "Special-order curb adapter — received and reserved",
      },
    ],
  },
];
