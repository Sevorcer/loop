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
  city: string;
  status: CustomerStatus;
}

export type CreateCustomerInput = CustomerInput;
export type UpdateCustomerInput = Partial<CustomerInput>;

const CUSTOMER_STATUSES = new Set<CustomerStatus>(["Active", "Prospect", "Inactive"]);

function normalizeCustomerInput(input: CustomerInput): CustomerInput {
  return {
    name: input.name.trim(),
    primaryContact: input.primaryContact.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    status: input.status,
  };
}

function validateCustomerInput(input: CustomerInput) {
  if (!input.name) throw new Error("Customer name is required.");
  if (!input.primaryContact) throw new Error("Primary contact is required.");
  if (!input.email) throw new Error("Email is required.");
  if (!input.city) throw new Error("City is required.");
  if (!CUSTOMER_STATUSES.has(input.status)) throw new Error("Invalid customer status.");
}

export async function listCustomers() {
  return listCustomerRecords();
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
    city: input.city ?? existing.city,
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
