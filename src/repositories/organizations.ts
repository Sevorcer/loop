import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface OrganizationWriteInput {
  name: string;
}

export interface ListOrganizationsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  includeDeleted?: boolean;
}

export interface OrganizationListResult {
  organizations: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface OrganizationRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

async function getClient(): Promise<SupabaseClient> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return supabase;
  }

  if (process.env.NODE_ENV !== "production") {
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      return adminClient;
    }
  }

  throw new Error("SUPABASE_SESSION_REQUIRED");
}

const COLUMNS = "id,name,created_at,updated_at,deleted_at";

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

export async function listOrganizations(
  options: ListOrganizationsOptions = {},
): Promise<OrganizationListResult> {
  const { page = 1, pageSize = 20, search, includeDeleted = false } = options;

  const supabase = await getClient();

  let query = supabase.from("organizations").select(COLUMNS, { count: "exact" });

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    organizations: ((data ?? []) as OrganizationRow[]).map(mapOrganization),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("organizations")
    .select(COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapOrganization(data as OrganizationRow) : null;
}

export async function createOrganization(input: OrganizationWriteInput): Promise<Organization> {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: input.name,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapOrganization(data as OrganizationRow);
}

export async function updateOrganization(
  id: string,
  input: Partial<OrganizationWriteInput>,
): Promise<Organization | null> {
  const supabase = await getClient();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updatePayload.name = input.name;

  const { data, error } = await supabase
    .from("organizations")
    .update(updatePayload)
    .eq("id", id)
    .is("deleted_at", null)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapOrganization(data as OrganizationRow) : null;
}

export async function softDeleteOrganization(id: string): Promise<boolean> {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("organizations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data !== null;
}
