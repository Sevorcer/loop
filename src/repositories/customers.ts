import "server-only";

import type { Customer, CustomerStatus } from "@/features/customers/types/customer";

import { loadLinkedPropertyIds } from "./properties";
import {
  buildIlikeOrFilter,
  OPEN_JOB_STATUS_EXCLUSION_FILTER,
  type PaginatedResult,
} from "./shared";
import { getRepositoryContext } from "./supabaseContext";

const CUSTOMER_COLUMNS =
  "id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at";
const CUSTOMER_DETAIL_COLUMNS = `${CUSTOMER_COLUMNS},state,parent_customer_id`;

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
  state?: string;
  parent_customer_id?: string | null;
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

function withLinkedPropertyCount(
  customer: Customer,
  linked: Map<string, string[]>,
): Customer {
  return {
    ...customer,
    propertyCount: linked.get(customer.id)?.length ?? 0,
  };
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
    state: row.state ?? "",
    notes: row.notes,
    status: row.status,
    propertyCount: row.property_count,
    openJobs: row.open_jobs,
    lastActivity: row.last_activity ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
  };
}

export interface ListCustomersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus;
  city?: string;
}

export async function listCustomers(
  options?: ListCustomersOptions,
): Promise<PaginatedResult<Customer>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("customers")
    .select("id,name,primary_contact,email,phone,phone2,city,street,zip,notes,status,property_count,open_jobs,last_activity,created_at", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const searchFilter = buildIlikeOrFilter(
    ["name", "primary_contact", "street", "city"],
    options?.search,
  );
  if (searchFilter) {
    query = query.or(searchFilter);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.city) {
    query = query.eq("city", options.city);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const linked = await loadLinkedPropertyIds();
  const items = ((data ?? []) as CustomerRow[]).map((row) => withLinkedPropertyCount(mapCustomer(row), linked));
  return { items, total: count ?? items.length, page, pageSize };
}

/**
 * Distinct non-empty customer cities for the directory filter dropdown.
 * Paged through the city column only so the option list stays complete no
 * matter how large the customer directory grows.
 */
export async function listCustomerCities(): Promise<string[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const cities = new Set<string>();
  const pageSize = 1000;
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("customers")
      .select("city")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Array<{ city?: string | null }>;
    for (const row of rows) {
      const city = typeof row.city === "string" ? row.city.trim() : "";
      if (city) {
        cities.add(city);
      }
    }
    if (rows.length < pageSize) {
      break;
    }
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}

function missingAccountColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703"
    || (/column/i.test(error.message ?? "") && /parent_customer_id|state/i.test(error.message ?? ""));
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const detail = await supabase
    .from("customers")
    .select(CUSTOMER_DETAIL_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  const fallback = detail.error && missingAccountColumn(detail.error)
    ? await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle()
    : detail;

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  if (!fallback.data) return null;
  const row = fallback.data as CustomerRow;
  const linked = await loadLinkedPropertyIds();
  const customer = withLinkedPropertyCount(mapCustomer(row), linked);
  if (!detail.error && row.parent_customer_id) {
    const parent = await supabase
      .from("customers")
      .select("id,name")
      .eq("org_id", orgId)
      .eq("id", row.parent_customer_id)
      .maybeSingle();
    if (parent.data) {
      customer.parentCustomer = { id: parent.data.id as string, name: parent.data.name as string };
    }
  }
  if (!detail.error) {
    const children = await supabase
      .from("customers")
      .select("id,name")
      .eq("org_id", orgId)
      .eq("parent_customer_id", id)
      .order("name");
    if (!children.error) {
      customer.childCustomers = ((children.data ?? []) as { id: string; name: string }[]).map((child) => ({
        id: child.id,
        name: child.name,
      }));
    }
  }
  return customer;
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

  if (!data) return null;
  const linked = await loadLinkedPropertyIds();
  return withLinkedPropertyCount(mapCustomer(data as CustomerRow), linked);
}

/** Rows that reference this customer and will block a delete. Includes cancelled jobs. */
export async function countCustomerReferences(
  customerId: string,
): Promise<{ jobs: number; properties: number }> {
  const { supabase, orgId } = await getRepositoryContext();
  const [jobs, properties] = await Promise.all([
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("customer_id", customerId),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("customer_id", customerId),
  ]);

  if (jobs.error) throw new Error(jobs.error.message);
  if (properties.error) throw new Error(properties.error.message);
  return { jobs: jobs.count ?? 0, properties: properties.count ?? 0 };
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
  const linked = await loadLinkedPropertyIds();
  return linked.get(customerId)?.length ?? 0;
}

export async function countOpenJobsForCustomer(customerId: string): Promise<number> {
  return countOpenJobsForCustomers([customerId]);
}

/**
 * Exact open-job count across one OR MORE customer ids, using a PostgREST
 * `head` count so the result is never capped by the 1000-row fetch limit.
 * Pass the id set [parentId, ...childIds] to roll a parent's child-customer
 * jobs up into a single count. An empty id set counts nothing.
 */
export async function countOpenJobsForCustomers(customerIds: string[]): Promise<number> {
  const ids = [...new Set(customerIds)].filter(Boolean);
  if (ids.length === 0) return 0;

  const { supabase, orgId } = await getRepositoryContext();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("customer_id", ids)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Exact total-job count (any status) across one or more customer ids. Backs
 * the "Jobs in Scope" tile, which must report the true number even for large
 * parents — a `.length` of a capped fetch silently stopped at 1000 rows.
 */
export async function countJobsForCustomers(customerIds: string[]): Promise<number> {
  const ids = [...new Set(customerIds)].filter(Boolean);
  if (ids.length === 0) return 0;

  const { supabase, orgId } = await getRepositoryContext();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("customer_id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Ids of the child customers that roll up into this parent. Returns an empty
 * list when the parent_customer_id column is absent (pre-migration schema) so
 * callers degrade to a single-customer count instead of failing.
 */
export async function listChildCustomerIds(parentId: string): Promise<string[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("parent_customer_id", parentId);

  if (error) {
    if (missingAccountColumn(error)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

/**
 * The parent customer id for a customer, or null when it has none (or the
 * parent_customer_id column is absent). Lets a counter sync also refresh the
 * parent's rolled-up count when a child's jobs change.
 */
export async function getParentCustomerId(customerId: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("parent_customer_id")
    .eq("org_id", orgId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    if (missingAccountColumn(error)) return null;
    throw new Error(error.message);
  }

  const parentId = (data as { parent_customer_id?: string | null } | null)?.parent_customer_id;
  return parentId ?? null;
}
