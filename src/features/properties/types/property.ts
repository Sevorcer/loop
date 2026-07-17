export type PropertyStatus =
  | "Active"
  | "Pending"
  | "Inactive";

export type PropertyType =
  | "Residential"
  | "Commercial"
  | "Multi-Family";

export interface Property {
  id: string;

  name: string;

  customer: string;

  address: string;

  city: string;

  type: PropertyType;

  status: PropertyStatus;

  primarySystem: string;

  openJobs: number;

  lastVisit: string;

  createdAt: string;
}