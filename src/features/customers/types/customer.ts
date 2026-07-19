export type CustomerStatus = "Active" | "Prospect" | "Inactive";

export interface Customer {
  id: string;
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  city: string;
  status: CustomerStatus;
  propertyCount: number;
  openJobs: number;
  lastActivity: string;
  createdAt: string;
}