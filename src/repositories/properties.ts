import "server-only";

import type {
  Property,
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";

import { OPEN_JOB_STATUS_EXCLUSION_FILTER, UNLINKED_CUSTOMER_LABEL } from "./shared";
import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

const PROPERTY_SELECT =
  "id,org_id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at";

interface PropertyRow {
  id: string;
  org_id: string;
  customer_id: string | null;
  name: string;
  address: string;
  city: string;
  type: string;
  status: string;
  primary_system: string;
  open_jobs: number;
  last_visit: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  place_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Write input types
// ---------------------------------------------------------------------------

export interface PropertyWriteInput {
  name: string;
  /** Display name used to resolve customerId when customerId is not supplied. */
  customer: string;
  /** Supply directly to skip the name-based lookup. */
  customerId?: string | null;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs?: number;
  lastVisit?: string;
  location?: PropertyLocation | null;
}

export interface PropertyUpdateInput {
  name?: string;
  customer?: string;
  customerId?: string | null;
  address?: string;
  city?: string;
  type?: PropertyType;
  status?: PropertyStatus;
  primarySystem?: string;
  openJobs?: number;
  lastVisit?: string;
  location?: PropertyLocation | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLocation(row: PropertyRow): PropertyLocation | undefined {
  if (row.latitude == null || row.longitude == null) return undefined;
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    formattedAddress: row.formatted_address ?? undefined,
    placeId: row.place_id ?? undefined,
  };
}

function mapProperty(row: PropertyRow, customerName: string): Property {
  return {
    id: row.id,
    name: row.name,
    customer: customerName,
    customerId: row.customer_id ?? undefined,
    address: row.address,
    city: row.city,
    type: row.type as PropertyType,
    status: row.status as PropertyStatus,
    primarySystem: row.primary_system,
    openJobs: row.open_jobs,
    lastVisit: row.last_visit ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    location: buildLocation(row),
  };
}

async function getCustomerNameMap(
  customerIds: string[],
  contextInput?: SessionRepositoryContextInput,
): Promise<Map<string, string>> {
  const uniqueCustomerIds = Array.from(new Set(customerIds.filter(Boolean)));
  const nameMap = new Map<string, string>();
  if (uniqueCustomerIds.length === 0) return nameMap;

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("customers")
    .select("id,name")
    .eq("org_id", orgId)
    .in("id", uniqueCustomerIds);

  if (error) throw new Error(error.message);
  for (const customer of data ?? []) nameMap.set(customer.id as string, customer.name as string);
  return nameMap;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listProperties(
  contextInput?: SessionRepositoryContextInput,
  options?: { page?: number; pageSize?: number; search?: string },
): Promise<Property[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  let query = supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (options?.search) {
    query = query.ilike("name", `%${options.search}%`);
  }

  const { data, error } = await query.range(from, to);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PropertyRow[];
  const customerIds = rows.map((r) => r.customer_id).filter(Boolean) as string[];
  const nameMap = await getCustomerNameMap(customerIds, contextInput);

  return rows.map((row) =>
    mapProperty(
      row,
      row.customer_id ? (nameMap.get(row.customer_id) ?? UNLINKED_CUSTOMER_LABEL) : UNLINKED_CUSTOMER_LABEL,
    ),
  );
}

export async function listPropertiesByCustomerId(
  customerId: string,
  contextInput?: SessionRepositoryContextInput,
  options?: { page?: number; pageSize?: number },
): Promise<Property[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PropertyRow[];
  const nameMap = await getCustomerNameMap([customerId], contextInput);
  const customerName = nameMap.get(customerId) ?? UNLINKED_CUSTOMER_LABEL;

  return rows.map((row) => mapProperty(row, customerName));
}

export async function getPropertyById(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property | null> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as PropertyRow;
  const nameMap = row.customer_id
    ? await getCustomerNameMap([row.customer_id], contextInput)
    : new Map<string, string>();
  const customerName = row.customer_id
    ? (nameMap.get(row.customer_id) ?? UNLINKED_CUSTOMER_LABEL)
    : UNLINKED_CUSTOMER_LABEL;

  return mapProperty(row, customerName);
}

export async function resolveCustomerIdByName(
  customerName: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<string | null> {
  if (!customerName) return null;
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", customerName)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function resolvePropertyIdByName(
  name: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<string | null> {
  if (!name) return null;
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function countOpenJobsForProperty(
  propertyId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createPropertyRecord(
  input: PropertyWriteInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const customerId =
    input.customerId !== undefined
      ? input.customerId
      : await resolveCustomerIdByName(input.customer, contextInput);

  const { data, error } = await supabase
    .from("properties")
    .insert({
      org_id: orgId,
      customer_id: customerId ?? null,
      name: input.name,
      address: input.address,
      city: input.city,
      type: input.type,
      status: input.status,
      primary_system: input.primarySystem,
      open_jobs: input.openJobs ?? 0,
      last_visit: input.lastVisit ?? new Date().toISOString().slice(0, 10),
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      formatted_address: input.location?.formattedAddress ?? null,
      place_id: input.location?.placeId ?? null,
    })
    .select(PROPERTY_SELECT)
    .single();

  if (error) {
    // Cast once to access Supabase-specific fields beyond the base PostgREST error shape
    const supabaseError = error as {
      code?: string;
      message?: string;
      details?: unknown;
      hint?: unknown;
      status?: number;
    };
    // Preserve full Supabase error fields so the route handler can surface them
    throw Object.assign(new Error(error.message), {
      code: supabaseError.code ?? null,
      details: supabaseError.details ?? null,
      hint: supabaseError.hint ?? null,
      status: supabaseError.status ?? null,
    });
  }

  return mapProperty(data as PropertyRow, input.customer);
}

export async function updatePropertyRecord(
  id: string,
  input: PropertyUpdateInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property | null> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.address !== undefined) updatePayload.address = input.address;
  if (input.city !== undefined) updatePayload.city = input.city;
  if (input.type !== undefined) updatePayload.type = input.type;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.primarySystem !== undefined) updatePayload.primary_system = input.primarySystem;
  if (input.openJobs !== undefined) updatePayload.open_jobs = input.openJobs;
  if (input.lastVisit !== undefined) updatePayload.last_visit = input.lastVisit;
  if (input.location !== undefined) {
    updatePayload.latitude = input.location?.latitude ?? null;
    updatePayload.longitude = input.location?.longitude ?? null;
    updatePayload.formatted_address = input.location?.formattedAddress ?? null;
    updatePayload.place_id = input.location?.placeId ?? null;
  }

  if (input.customerId !== undefined) {
    updatePayload.customer_id = input.customerId;
  } else if (input.customer !== undefined) {
    updatePayload.customer_id = await resolveCustomerIdByName(input.customer, contextInput);
  }

  const { data, error } = await supabase
    .from("properties")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(PROPERTY_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as PropertyRow;
  let customerName = input.customer;
  if (!customerName) {
    if (row.customer_id) {
      const nameMap = await getCustomerNameMap([row.customer_id], contextInput);
      customerName = nameMap.get(row.customer_id) ?? UNLINKED_CUSTOMER_LABEL;
    } else {
      customerName = UNLINKED_CUSTOMER_LABEL;
    }
  }

  return mapProperty(row, customerName);
}

export async function deletePropertyRecord(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { error, count } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
  return Boolean(count);
}