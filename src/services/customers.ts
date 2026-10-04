import "server-only";

import type { Customer, CustomerStatus } from "@/features/customers/types/customer";
import type { CustomerJobItem, CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import {
  countOpenJobsForCustomer,
  countPropertiesForCustomer,
  createCustomer as createCustomerRecord,
  deleteCustomer as deleteCustomerRecord,
  getCustomerById,
  listCustomers as listCustomerRecords,
  updateCustomer as updateCustomerRecord,
} from "@/repositories/customers";
import { listPropertiesByCustomerId } from "@/repositories/properties";
import { listJobsByCustomerId } from "@/repositories/jobs";

export interface CustomerInput {
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
}

export type CreateCustomerInput = CustomerInput;
export type UpdateCustomerInput = Partial<CustomerInput>;

const CUSTOMER_STATUSES = new Set<CustomerStatus>(["Active", "Prospect", "Inactive"]);

function normalizeCustomerInput(input: CustomerInput): CustomerInput {
  const name = input.name.trim();
  const primaryContact = input.primaryContact.trim();
  return {
    // F2: residential customers may leave Account Name blank — fall back to the
    // primary contact so the DB NOT NULL constraint stays satisfied.
    name: name.length > 0 ? name : primaryContact,
    primaryContact,
    email: input.email.trim(),
    phone: input.phone.trim(),
    phone2: input.phone2.trim(),
    city: input.city.trim(),
    street: input.street.trim(),
    zip: input.zip.trim(),
    notes: input.notes.trim(),
    status: input.status,
  };
}

function validateCustomerInput(input: CustomerInput) {
  if (!input.name) throw new Error("Customer name is required.");
  
  
  
  if (!CUSTOMER_STATUSES.has(input.status)) throw new Error("Invalid customer status.");
}

export async function listCustomers(options?: { search?: string }) {
  return listCustomerRecords(options);
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  return getCustomerById(id);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return fetchCustomerById(id);
}

export async function createCustomer(input: CreateCustomerInput) {
  const normalized = normalizeCustomerInput(input);
  validateCustomerInput(normalized);

  return createCustomerRecord({
    ...normalized,
    propertyCount: 0,
    openJobs: 0,
    lastActivity: new Date().toISOString().slice(0, 10),
  });
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const existing = await getCustomerById(id);

  if (!existing) {
    return null;
  }

  const merged = normalizeCustomerInput({
    name: input.name ?? existing.name,
    primaryContact: input.primaryContact ?? existing.primaryContact,
    email: input.email ?? existing.email,
    phone: input.phone ?? existing.phone,
    phone2: input.phone2 ?? existing.phone2,
    city: input.city ?? existing.city,
    street: input.street ?? existing.street,
    zip: input.zip ?? existing.zip,
    notes: input.notes ?? existing.notes,
    status: input.status ?? existing.status,
  });

  validateCustomerInput(merged);

  return updateCustomerRecord(id, merged);
}

export async function syncCustomerCounters(customerId: string) {
  const [propertyCount, openJobs] = await Promise.all([
    countPropertiesForCustomer(customerId),
    countOpenJobsForCustomer(customerId),
  ]);

  return updateCustomerRecord(customerId, {
    propertyCount,
    openJobs,
    lastActivity: new Date().toISOString().slice(0, 10),
  });
}

export async function deleteCustomer(id: string) {
  return deleteCustomerRecord(id);
}

export async function getCustomerProperties(customerId: string): Promise<CustomerPropertyItem[]> {
  const properties = await listPropertiesByCustomerId(customerId);
  return properties.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    status: p.status,
    primarySystem: p.primarySystem,
    createdAt: p.createdAt,
    lastVisit: p.lastVisit,
  }));
}

export async function getCustomerJobs(customerId: string): Promise<CustomerJobItem[]> {
  const jobs = await listJobsByCustomerId(customerId);
  return jobs.map((j) => ({
    id: j.id,
    jobNumber: j.jobNumber,
    title: j.title,
    status: j.status,
    scheduledFor: j.scheduledFor ?? "",
    propertyId: j.propertyId ?? undefined,
    propertyName: j.propertyName,
  }));
}
