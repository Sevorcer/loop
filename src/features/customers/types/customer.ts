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
  /** State from the primary address. Empty until a record has one. */
  state?: string;
  /** Builder or property manager this job site belongs to. */
  parentCustomer?: { id: string; name: string } | null;
  /** Job sites that belong to this account. */
  childCustomers?: { id: string; name: string }[];
}