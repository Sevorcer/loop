export type CustomerStatus = "Active" | "Prospect" | "Inactive";

export interface Customer {
  id: string;
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  phone2: string;
  city: string;
  street: string;
  zip: string;
  notes: string;
  status: CustomerStatus;
  propertyCount: number;
  openJobs: number;
  lastActivity: string;
  createdAt: string;
}