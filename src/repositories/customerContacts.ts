import "server-only";

import type {
  CustomerContact,
  ContactRole,
} from "@/features/customers/types/customerContact";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface CustomerContactRow {
  id: string;
  customer_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

const CONTACT_COLUMNS =
  "id,customer_id,name,role,phone,email,is_primary,created_at,updated_at";

function mapContact(row: CustomerContactRow): CustomerContact {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    role: row.role as ContactRole,
    phone: row.phone,
    email: row.email,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listContactsByCustomerId(
  customerId: string,
): Promise<CustomerContact[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customer_contacts")
    .select(CONTACT_COLUMNS)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as CustomerContactRow[]).map(mapContact);
}

export async function getContactById(
  contactId: string,
): Promise<CustomerContact | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customer_contacts")
    .select(CONTACT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapContact(data as CustomerContactRow);
}

export interface CreateContactInput {
  customerId: string;
  name: string;
  role: ContactRole;
  phone: string;
  email: string;
}

export async function createContact(
  input: CreateContactInput,
): Promise<CustomerContact> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customer_contacts")
    .insert({
      org_id: orgId,
      customer_id: input.customerId,
      name: input.name,
      role: input.role,
      phone: input.phone,
      email: input.email,
      is_primary: false,
    })
    .select(CONTACT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapContact(data as CustomerContactRow);
}

export interface UpdateContactInput {
  name?: string;
  role?: ContactRole;
  phone?: string;
  email?: string;
}

export async function updateContact(
  contactId: string,
  input: UpdateContactInput,
): Promise<CustomerContact | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role = input.role;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.email !== undefined) payload.email = input.email;

  const { data, error } = await supabase
    .from("customer_contacts")
    .update(payload)
    .eq("org_id", orgId)
    .eq("id", contactId)
    .select(CONTACT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapContact(data as CustomerContactRow);
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error, count } = await supabase
    .from("customer_contacts")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", contactId);

  if (error) throw new Error(error.message);
  return Boolean(count);
}
