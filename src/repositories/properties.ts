import "server-only";

import type {
  Property,
  PropertyLocation,
  PropertyStatus,
  PropertyType,
} from "@/features/properties/types/property";

import { OPEN_JOB_STATUS_EXCLUSION_FILTER, UNLINKED_CUSTOMER_LABEL } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

interface PropertyRow {
  id: string;
  customer_id: string | null;
  name: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primary_system: string;
  open_jobs: number;
  last_visit: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  place_id: string | null;
  created_at: string;
}

export interface PropertyWriteInput {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
  openJobs?: number;
  lastVisit?: string | null;
  location?: PropertyLocation;
}

function mapLocation(row: PropertyRow): PropertyLocation | undefined {
  if (row.latitude === null || row.longitude === null) {
    return undefined;
  }

  return {
    latitude: row.latitude,
    longitude: row.longitude,
    formattedAddress: row.formatted_address ?? undefined,
    placeId: row.place_id ?? undefined,
  };
}

function resolveCustomerName(customerId: string | null, customerNames: Map<string, string>) {
  return customerNames.get(customerId ?? "") ?? UNLINKED_CUSTOMER_LABEL;
}

function mapProperty(row: PropertyRow, customerName: string): Property {
  return {
    id: row.id,
    name: row.name,
    customer: customerName,
    address: row.address,
    city: row.city,
    type: row.type,
    status: row.status,
    primarySystem: row.primary_system,
    openJobs: row.open_jobs,
    lastVisit: row.last_visit ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    location: mapLocation(row),
  };
}

async function getCustomerNameMap(customerIds: string[]): Promise<Map<string, string>> {
  const uniqueCustomerIds = Array.from(new Set(customerIds.filter(Boolean)));
  const nameMap = new Map<string, string>();

  if (uniqueCustomerIds.length === 0) {
    return nameMap;
  }

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name")
    .eq("org_id", orgId)
    .in("id", uniqueCustomerIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const customer of data ?? []) {
    nameMap.set(customer.id as string, customer.name as string);
  }

  return nameMap;
}

export async function resolveCustomerIdByName(customerName: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", customerName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.id as string | undefined) ?? null;
}

export async function listProperties(): Promise<Property[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PropertyRow[];
  const customerNames = await getCustomerNameMap(
    rows.map((property) => property.customer_id ?? ""),
  );

  return rows.map((row) => mapProperty(row, resolveCustomerName(row.customer_id, customerNames)));
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at",
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as PropertyRow;
  const customerNames = await getCustomerNameMap([row.customer_id ?? ""]);
  return mapProperty(row, resolveCustomerName(row.customer_id, customerNames));
}

export async function createProperty(input: PropertyWriteInput): Promise<Property> {
  const { supabase, orgId } = await getRepositoryContext();
  const customerId = await resolveCustomerIdByName(input.customer);
  const { data, error } = await supabase
    .from("properties")
    .insert({
      org_id: orgId,
      customer_id: customerId,
      name: input.name,
      address: input.address,
      city: input.city,
      type: input.type,
      status: input.status,
      primary_system: input.primarySystem,
      open_jobs: input.openJobs ?? 0,
      last_visit: input.lastVisit,
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      formatted_address: input.location?.formattedAddress ?? null,
      place_id: input.location?.placeId ?? null,
    })
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProperty(data as PropertyRow, input.customer);
}

export async function updateProperty(
  id: string,
  input: Partial<PropertyWriteInput>,
): Promise<Property | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const updatePayload: Record<string, unknown> = {};
  let customerName = input.customer;

  if (input.customer !== undefined) {
    updatePayload.customer_id = input.customer
      ? await resolveCustomerIdByName(input.customer)
      : null;
  }
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

  const { data, error } = await supabase
    .from("properties")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as PropertyRow;

  if (!customerName) {
    const customerNames = await getCustomerNameMap([row.customer_id ?? ""]);
    customerName = resolveCustomerName(row.customer_id, customerNames);
  }

  return mapProperty(row, customerName);
}

export async function deleteProperty(id: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error, count } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(count);
}

export async function countOpenJobsForProperty(propertyId: string): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function listPropertiesByCustomerId(customerId: string): Promise<Property[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at",
    )
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PropertyRow[];
  const customerNames = await getCustomerNameMap([customerId]);

  return rows.map((row) => mapProperty(row, resolveCustomerName(row.customer_id, customerNames)));
}
