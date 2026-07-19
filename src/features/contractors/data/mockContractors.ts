import type { Contractor } from "../types/contractor";

export const mockContractors: Contractor[] = [
  {
    id: "contractor-001",
    companyName: "Arctic Air Solutions",
    contactName: "James Herrera",
    email: "james@arcticair.com",
    phone: "206-555-0101",
    trade: "HVAC",
    active: true,
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "contractor-002",
    companyName: "Volt Masters Electric",
    contactName: "Sandra Kim",
    email: "sandra@voltmasters.com",
    phone: "206-555-0202",
    trade: "Electrical",
    active: true,
    createdAt: "2026-02-03T10:30:00.000Z",
  },
  {
    id: "contractor-003",
    companyName: "Pacific Plumbing Co.",
    contactName: "Derek Osei",
    email: "derek@pacificplumbing.com",
    phone: "206-555-0303",
    trade: "Plumbing",
    active: true,
    createdAt: "2026-03-10T08:15:00.000Z",
  },
];
