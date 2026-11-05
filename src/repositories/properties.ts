import "server-only";

import type {
  Property,
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";

import {
  isCustomerUuid,
  linkedPropertyIdsByCustomer,
  resolvePropertyCustomer,
  type JobCustomerHint,
} from "./propertyCustomerLink";
import {
  buildIlikeOrFilter,
  OPEN_JOB_STATUS_EXCLUSION_FILTER,
  UNLINKED_CUSTOMER_LABEL,
  type PaginatedResult,
} from "./shared";
import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

const PROPERTY_SELECT_BASE =
  "id,org_id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at";

let propertyRegionReady = true;

function propertySelect(): string {
  return propertyRegionReady ? `${PROPERTY_SELECT_BASE},state,zip` : PROPERTY_SELECT_BASE;
}

function missingRegionColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column/i.test(error.message ?? "") && /state|zip/i.test(error.message ?? "");
}

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
  state?: string;
  zip?: string;
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

interface PropertyReadResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

async function readPropertyRows(
  run: (columns: string) => PromiseLike<PropertyReadResult>,
): Promise<PropertyReadResult> {
  const first = await run(propertySelect());
  if (first.error && propertyRegionReady && missingRegionColumn(first.error)) {
    propertyRegionReady = false;
    return run(propertySelect());
  }
  return first;
}

function mapProperty(row: PropertyRow, customerName: string): Property {
  return {
    id: row.id,
    name: row.name,
    customer: customerName,
    customerId: row.customer_id ?? undefined,
    address: row.address,
    city: row.city,
    state: row.state ?? "",
    zip: row.zip ?? "",
    type: row.type as PropertyType,
    status: row.status as PropertyStatus,
    primarySystem: row.primary_system,
    openJobs: row.open_jobs,
    lastVisit: row.last_visit ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    location: buildLocation(row),
  };
}

async function loadJobCustomerHints(
  propertyIds: string[],
  propertyNames: string[],
  contextInput?: SessionRepositoryContextInput,
): Promise<JobCustomerHint[]> {
  const ids = Array.from(new Set(propertyIds.filter(Boolean)));
  const names = Array.from(new Set(propertyNames.map((name) => name.trim()).filter(Boolean)));
  if (ids.length === 0 && names.length === 0) return [];

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const hints: JobCustomerHint[] = [];

  async function read(filter: "id" | "name", values: string[]) {
    if (values.length === 0) return;
    let query = supabase
      .from("jobs")
      .select("property_id,property_name,customer_id,customer_name")
      .eq("org_id", orgId);
    query = filter === "id" ? query.in("property_id", values) : query.in("property_name", values);
    const { data, error } = await query;
    if (error) return;
    for (const row of data ?? []) {
      hints.push({
        propertyId: (row.property_id as string | null) ?? null,
        propertyName: typeof row.property_name === "string" ? row.property_name : "",
        customerId: (row.customer_id as string | null) ?? null,
        customerName: typeof row.customer_name === "string" ? row.customer_name : "",
      });
    }
  }

  await Promise.all([read("id", ids), read("name", names)]);
  return hints;
}

const CUSTOMER_DIRECTORY_PAGE_SIZE = 1000;
const CUSTOMER_DIRECTORY_PAGE_LIMIT = 50;

/**
 * Full customer id→name directory for property name resolution.
 * Must page: PostgREST caps a single response at 1,000 rows and live has
 * 1,395 customers, so an unpaged read silently dropped ~395 names.
 */
async function loadCustomerDirectory(
  contextInput?: SessionRepositoryContextInput,
): Promise<{ id: string; name: string }[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const customers: { id: string; name: string }[] = [];
  for (let page = 0; page < CUSTOMER_DIRECTORY_PAGE_LIMIT; page += 1) {
    const from = page * CUSTOMER_DIRECTORY_PAGE_SIZE;
    const to = from + CUSTOMER_DIRECTORY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("customers")
      .select("id,name")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, to);
    if (error) return customers.length > 0 ? customers : [];
    const batch = (data ?? []).map((customer) => ({
      id: customer.id as string,
      name: customer.name as string,
    }));
    customers.push(...batch);
    if (batch.length < CUSTOMER_DIRECTORY_PAGE_SIZE) break;
  }
  return customers;
}

async function withCustomerNames(
  rows: PropertyRow[],
  contextInput?: SessionRepositoryContextInput,
): Promise<Property[]> {
  if (rows.length === 0) return [];

  const directIds = rows.map((row) => row.customer_id).filter(Boolean) as string[];
  const nameMap = await getCustomerNameMap(directIds, contextInput);
  const unresolved = rows.filter((row) => !row.customer_id || !nameMap.has(row.customer_id));

  let customers = Array.from(nameMap.entries()).map(([id, name]) => ({ id, name }));
  let hints: JobCustomerHint[] = [];
  if (unresolved.length > 0) {
    const [directory, jobHints] = await Promise.all([
      loadCustomerDirectory(contextInput),
      loadJobCustomerHints(
        unresolved.map((row) => row.id),
        unresolved.map((row) => row.name),
        contextInput,
      ),
    ]);
    customers = directory.length > 0 ? directory : customers;
    hints = jobHints;
  }

  return rows.map((row) => {
    const resolved = resolvePropertyCustomer({
      propertyId: row.id,
      propertyName: row.name,
      customerId: row.customer_id,
      customers,
      jobHints: hints,
    });
    return mapProperty(
      { ...row, customer_id: resolved.customerId ?? row.customer_id },
      resolved.customerName,
    );
  });
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

export interface ListPropertiesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PropertyStatus;
  type?: PropertyType;
  city?: string;
}

export async function listProperties(
  contextInput?: SessionRepositoryContextInput,
  options?: ListPropertiesOptions,
): Promise<PaginatedResult<Property>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error, count } = await readPropertyRows((columns) => {
    let query = supabase
      .from("properties")
      .select(columns, { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    const searchFilter = buildIlikeOrFilter(
      ["name", "address", "city", "primary_system"],
      options?.search,
    );
    if (searchFilter) {
      query = query.or(searchFilter);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.type) {
      query = query.eq("type", options.type);
    }
    if (options?.city) {
      query = query.eq("city", options.city);
    }
    return query.range(from, to);
  });

  if (error) throw new Error(error.message);

  const items = await withCustomerNames((data ?? []) as PropertyRow[], contextInput);
  return { items, total: count ?? items.length, page, pageSize };
}

/**
 * Distinct non-empty property cities for the directory filter dropdown.
 * Paged through the city column only so the option list stays complete no
 * matter how large the property directory grows.
 */
export async function listPropertyCities(
  contextInput?: SessionRepositoryContextInput,
): Promise<string[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const cities = new Set<string>();
  const pageSize = 1000;
  for (let page = 0; page < 50; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("properties")
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

const LINK_PAGE_SIZE = 1000;
const LINK_PAGE_LIMIT = 20;

async function readPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < LINK_PAGE_LIMIT; page += 1) {
    const from = page * LINK_PAGE_SIZE;
    const to = from + LINK_PAGE_SIZE - 1;
    const { data, error } = await read(from, to);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < LINK_PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Property ids grouped by the customer the property list would display.
 * Includes properties.customer_id and properties that resolve through jobs.
 */
export async function loadLinkedPropertyIds(
  contextInput?: SessionRepositoryContextInput,
): Promise<Map<string, string[]>> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const propertyRows = await readPages<{ id: string; name: string | null; customer_id: string | null }>(
    (from, to) =>
      supabase
        .from("properties")
        .select("id,name,customer_id")
        .eq("org_id", orgId)
        .order("id", { ascending: true })
        .range(from, to),
  );

  const customers = await readPages<{ id: string; name: string | null }>((from, to) =>
    supabase
      .from("customers")
      .select("id,name")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const jobRows = await readPages<{
    property_id: string | null;
    property_name: string | null;
    customer_id: string | null;
    customer_name: string | null;
  }>((from, to) =>
    supabase
      .from("jobs")
      .select("property_id,property_name,customer_id,customer_name")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const hints: JobCustomerHint[] = jobRows.map((row) => ({
    propertyId: row.property_id,
    propertyName: row.property_name ?? "",
    customerId: row.customer_id,
    customerName: row.customer_name ?? "",
  }));

  return linkedPropertyIdsByCustomer({
    properties: propertyRows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      customerId: row.customer_id,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name ?? "",
    })),
    jobHints: hints,
  });
}

export async function listPropertiesByCustomerId(
  customerId: string,
  contextInput?: SessionRepositoryContextInput,
  options?: { page?: number; pageSize?: number },
): Promise<Property[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const ids = await loadLinkedPropertyIdsForCustomer(customerId, contextInput);
  if (ids.length === 0) return [];

  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const rows: PropertyRow[] = [];
  const chunkSize = 80;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const { data, error } = await readPropertyRows((columns) =>
      supabase.from("properties").select(columns).eq("org_id", orgId).in("id", chunk),
    );
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as PropertyRow[]));
  }

  rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
  const from = (page - 1) * pageSize;
  return withCustomerNames(rows.slice(from, from + pageSize), contextInput);
}

export async function getPropertyById(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property | null> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await readPropertyRows((columns) =>
    supabase.from("properties").select(columns).eq("org_id", orgId).eq("id", id).maybeSingle(),
  );

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [property] = await withCustomerNames([data as PropertyRow], contextInput);
  return property ?? null;
}

export async function resolveCustomerIdByName(
  customerName: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<string | null> {
  const trimmed = customerName.trim();
  if (!trimmed) return null;
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  if (isCustomerUuid(trimmed)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("org_id", orgId)
      .eq("id", trimmed)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data.id as string;
  }

  const pattern = trimmed.replace(/[%_\\]/g, (character) => `\\${character}`);
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", pattern)
    .limit(2);

  if (error) throw new Error(error.message);
  const matches = (data ?? []) as { id: string }[];
  return matches.length === 1 ? matches[0].id : null;
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
    .limit(2);

  if (error) throw new Error(error.message);
  // Duplicate property names (e.g. after a Service Fusion import) resolve to
  // null rather than throwing, mirroring resolveCustomerIdByName above.
  const matches = (data ?? []) as { id: string }[];
  return matches.length === 1 ? matches[0].id : null;
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
// Scoped property-customer link helpers (single-customer reads)
// ---------------------------------------------------------------------------

/**
 * Property ids linked to a single customer — scoped version of
 * loadLinkedPropertyIds that avoids full-table scans. Fetches only the
 * properties with customer_id = customerId plus any properties referenced by
 * jobs belonging to the customer (the "hint" path), so cost is bounded by the
 * customer's own data.
 */
export async function loadLinkedPropertyIdsForCustomer(
  customerId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<string[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  // 1. Properties with a direct FK to the customer
  const directResult = await readPages<{ id: string }>(
    (from, to) =>
      supabase
        .from("properties")
        .select("id")
        .eq("org_id", orgId)
        .eq("customer_id", customerId)
        .order("id", { ascending: true })
        .range(from, to),
  );

  // 2. Jobs belonging to this customer may reference properties that lack a
  //    customer_id FK (the "hint" path). Collect any property_ids from those
  //    jobs that are not already in the direct set.
  const directIds = new Set(directResult.map((row) => row.id));

  const jobPropertyRows = await readPages<{ property_id: string | null }>(
    (from, to) =>
      supabase
        .from("jobs")
        .select("property_id")
        .eq("org_id", orgId)
        .eq("customer_id", customerId)
        .not("property_id", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
  );

  for (const row of jobPropertyRows) {
    if (row.property_id) {
      directIds.add(row.property_id);
    }
  }

  return Array.from(directIds);
}

/**
 * Bounded property count for a single customer. Uses the scoped link helper
 * instead of scanning all three tables.
 */
export async function countLinkedPropertiesForCustomer(
  customerId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<number> {
  const ids = await loadLinkedPropertyIdsForCustomer(customerId, contextInput);
  return ids.length;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createPropertyRecord(
  input: PropertyWriteInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<Property> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const explicitCustomerId = input.customerId?.trim() || null;
  const customerId = explicitCustomerId
    ? explicitCustomerId
    : await resolveCustomerIdByName(input.customer, contextInput);

  const { data, error } = await readPropertyRows((columns) =>
    supabase
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
      .select(columns)
      .single(),
  );

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

  const row = data as PropertyRow;
  let displayName = input.customer.trim();
  if (row.customer_id) {
    const nameMap = await getCustomerNameMap([row.customer_id], contextInput);
    displayName = nameMap.get(row.customer_id) ?? (displayName || UNLINKED_CUSTOMER_LABEL);
  } else if (!displayName) {
    displayName = UNLINKED_CUSTOMER_LABEL;
  }

  return mapProperty(row, displayName);
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

  const { data, error } = await readPropertyRows((columns) =>
    supabase
      .from("properties")
      .update(updatePayload)
      .eq("org_id", orgId)
      .eq("id", id)
      .select(columns)
      .maybeSingle(),
  );

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