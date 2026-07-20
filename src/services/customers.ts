import "server-only";

import type { Customer } from "@/features/customers/types/customer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CustomerRow = {
  id: string;
  name: string;
  primary_contact: string;
  email: string;
  phone: string;
  city: string;
  status: Customer["status"];
  property_count: number;
  open_jobs: number;
  last_activity: string | null;
  created_at: string;
};

export interface CreateCustomerInput {
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  city: string;
  status: Customer["status"];
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

const DEV_ORG_ID = process.env.LOOP_DEV_ORG_ID ?? null;

async function resolveOrgId() {
  if (DEV_ORG_ID) {
    return DEV_ORG_ID;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Unable to resolve organization id.");
  }

  return data.id as string;
}

function toCustomer(row: CustomerRow): Customer {
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
    createdAt: row.created_at.slice(0, 10),
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toCustomer(row as CustomerRow));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at"
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toCustomer(data as CustomerRow) : null;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

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
      last_activity: today,
    })
    .select(
      "id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create customer.");
  }

  return toCustomer(data as CustomerRow);
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer | null> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.primaryContact !== undefined) patch.primary_contact = input.primaryContact;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.city !== undefined) patch.city = input.city;
  if (input.status !== undefined) patch.status = input.status;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(
      "id,name,primary_contact,email,phone,city,status,property_count,open_jobs,last_activity,created_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toCustomer(data as CustomerRow) : null;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}
