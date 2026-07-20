import "server-only";

import type { Property, PropertyLocation } from "@/features/properties/types/property";
import { formatPropertyAddress } from "@/features/properties/utils/formatPropertyAddress";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { geocodeAddress } from "./geocoding";

type PropertyRow = {
  id: string;
  customer_id: string | null;
  name: string;
  address: string;
  city: string;
  type: Property["type"];
  status: Property["status"];
  primary_system: string;
  open_jobs: number;
  last_visit: string | null;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string | null;
  place_id: string | null;
  created_at: string;
  customers?: { name: string } | null;
};

export interface CreatePropertyInput {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: Property["type"];
  status: Property["status"];
  primarySystem: string;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export type GeocodeStatus =
  | "geocoded"
  | "geocode_failed_location_preserved"
  | "location_unchanged"
  | "no_location";

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

function toProperty(row: PropertyRow): Property {
  const location: PropertyLocation | undefined =
    row.latitude !== null && row.longitude !== null
      ? {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          formattedAddress: row.formatted_address ?? undefined,
          placeId: row.place_id ?? undefined,
        }
      : undefined;

  return {
    id: row.id,
    name: row.name,
    customer: row.customers?.name ?? "Unassigned Customer",
    address: row.address,
    city: row.city,
    type: row.type,
    status: row.status,
    primarySystem: row.primary_system,
    openJobs: row.open_jobs,
    lastVisit: row.last_visit ?? row.created_at.slice(0, 10),
    createdAt: row.created_at,
    location,
  };
}

async function resolveLocation(
  address: string,
  city: string
): Promise<{ location: PropertyLocation | undefined; geocoded: boolean }> {
  const fullAddress = formatPropertyAddress({ address, city });
  const result = await geocodeAddress(fullAddress);

  if (!result.success) {
    return { location: undefined, geocoded: false };
  }

  return { location: result.location, geocoded: true };
}

async function findCustomerIdByName(orgId: string, name: string): Promise<string | null> {
  const normalized = name.trim();
  if (!normalized) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", normalized)
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

export async function listProperties(): Promise<Property[]> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at,customers(name)"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toProperty(row as PropertyRow));
}

export async function getProperty(id: string): Promise<Property | null> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at,customers(name)"
    )
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toProperty(data as PropertyRow) : null;
}

export async function createProperty(
  input: CreatePropertyInput
): Promise<{ property: Property; geocodeStatus: GeocodeStatus }> {
  const orgId = await resolveOrgId();
  const customerId = await findCustomerIdByName(orgId, input.customer);
  const { location, geocoded } = await resolveLocation(input.address, input.city);
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

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
      last_visit: today,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      formatted_address: location?.formattedAddress ?? null,
      place_id: location?.placeId ?? null,
    })
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at,customers(name)"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create property.");
  }

  return {
    property: toProperty(data as PropertyRow),
    geocodeStatus: geocoded ? "geocoded" : "no_location",
  };
}

export async function updateProperty(
  id: string,
  changes: UpdatePropertyInput
): Promise<{ property: Property; geocodeStatus: GeocodeStatus } | null> {
  const orgId = await resolveOrgId();
  const existing = await getProperty(id);

  if (!existing) {
    return null;
  }

  const addressChanged =
    (changes.address !== undefined && changes.address !== existing.address) ||
    (changes.city !== undefined && changes.city !== existing.city);

  let location = existing.location;
  let geocodeStatus: GeocodeStatus = "location_unchanged";

  if (addressChanged) {
    const resolved = await resolveLocation(
      changes.address ?? existing.address,
      changes.city ?? existing.city
    );

    if (resolved.geocoded) {
      location = resolved.location;
      geocodeStatus = "geocoded";
    } else {
      geocodeStatus = existing.location
        ? "geocode_failed_location_preserved"
        : "no_location";
    }
  }

  const customerId =
    changes.customer !== undefined
      ? await findCustomerIdByName(orgId, changes.customer)
      : null;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    formatted_address: location?.formattedAddress ?? null,
    place_id: location?.placeId ?? null,
  };

  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.address !== undefined) patch.address = changes.address;
  if (changes.city !== undefined) patch.city = changes.city;
  if (changes.type !== undefined) patch.type = changes.type;
  if (changes.status !== undefined) patch.status = changes.status;
  if (changes.primarySystem !== undefined) patch.primary_system = changes.primarySystem;
  if (changes.customer !== undefined) patch.customer_id = customerId;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(
      "id,customer_id,name,address,city,type,status,primary_system,open_jobs,last_visit,latitude,longitude,formatted_address,place_id,created_at,customers(name)"
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    property: toProperty(data as PropertyRow),
    geocodeStatus,
  };
}

export async function deleteProperty(id: string): Promise<boolean> {
  const orgId = await resolveOrgId();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}
