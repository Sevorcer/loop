import "server-only";

import type { Customer, CustomerStatus } from "@/features/customers/types/customer";

import { getRepositoryContext } from "./supabaseContext";

interface CustomerRow {
  id: string;
  name: string;
  primary_contact: string;
  email: string;
  phone: string;
  city: string;
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
  city: string;
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
    city: row.city,
    status: row.status,
    propertyCount: row.property_count,
    openJobs: row.open_jobs,
    lastActivity: row.last_activity ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CustomerRow[]).map(mapCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at")
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
      city: input.city,
      status: input.status,
      property_count: input.propertyCount ?? 0,
      open_jobs: input.openJobs ?? 0,
      last_activity: input.lastActivity ?? new Date().toISOString().slice(0, 10),
    })
    .select("id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at")
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
  if (input.city !== undefined) updatePayload.city = input.city;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.propertyCount !== undefined) updatePayload.property_count = input.propertyCount;
  if (input.openJobs !== undefined) updatePayload.open_jobs = input.openJobs;
  if (input.lastActivity !== undefined) updatePayload.last_activity = input.lastActivity;

  const { data, error } = await supabase
    .from("customers")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at")
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
    .not("status", "in", '("Completed","Cancelled")');

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
