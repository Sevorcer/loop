import "server-only";

import type { Customer, CustomerStatus } from "@/features/customers/types/customer";

import { OPEN_JOB_STATUS_EXCLUSION_FILTER } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

interface CustomerRow {
  id: string;
  name: string;
  primary_contact: string;
  email: string;
  phone: string;
  phone2: string;
  city: string;
  street: string;
  zip: string;
  notes: string;
  status: CustomerStatus;
  property_count: number;
  open_jobs: number;
  last_activity: string | null;
  created_at: string;
}

export interface CustomerWriteInput {
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
  propertyCount?: number;
  openJobs?: number;
  lastActivity?: string | null;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    primaryContact: row.primary_contact,
    email: row.email,
    phone: row.phone,
    phone2: row.phone2,
    city: row.city,
    street: row.street,
    zip: row.zip,
    notes: row.notes,
    status: row.status,
    propertyCount: row.property_count,
    openJobs: row.open_jobs,
    lastActivity: row.last_activity ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
  };
}

export async function listCustomers(
  options?: { page?: number; pageSize?: number; search?: string },
): Promise<Customer[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("customers")
    .select("id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.search) {
    query = query.ilike("name", `%${options.search}%`);
  }

  const { data, error } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CustomerRow[]).map(mapCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function createCustomer(input: CustomerWriteInput): Promise<Customer> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      org_id: orgId,
      name: input.name,
      primary_contact: input.primaryContact,
      email: input.email,
      phone: input.phone,
      phone2: input.phone2,
      city: input.city,
      street: input.street,
      zip: input.zip,
      notes: input.notes,
      status: input.status,
      property_count: input.propertyCount ?? 0,
      open_jobs: input.openJobs ?? 0,
      last_activity: input.lastActivity ?? new Date().toISOString().slice(0, 10),
    })
    .select("id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCustomer(data as CustomerRow);
}

export async function updateCustomer(
  id: string,
  input: Partial<CustomerWriteInput>,
): Promise<Customer | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const updatePayload: Record<string, unknown> = {};

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.primaryContact !== undefined) updatePayload.primary_contact = input.primaryContact;
  if (input.email !== undefined) updatePayload.email = input.email;
  if (input.phone !== undefined) updatePayload.phone = input.phone;
  if (input.phone2 !== undefined) updatePayload.phone2 = input.phone2;
  if (input.city !== undefined) updatePayload.city = input.city;
  if (input.street !== undefined) updatePayload.street = input.street;
  if (input.zip !== undefined) updatePayload.zip = input.zip;
  if (input.notes !== undefined) updatePayload.notes = input.notes;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.propertyCount !== undefined) updatePayload.property_count = input.propertyCount;
  if (input.openJobs !== undefined) updatePayload.open_jobs = input.openJobs;
  if (input.lastActivity !== undefined) updatePayload.last_activity = input.lastActivity;

  const { data, error } = await supabase
    .from("customers")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapCustomer(data as CustomerRow) : null;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(count);
}

export async function countPropertiesForCustomer(customerId: string): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("customer_id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function countOpenJobsForCustomer(customerId: string): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
