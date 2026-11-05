import "server-only";

import type {
  InstalledSystem,
  InstalledSystemLifecycle,
  InstalledSystemsCounts,
  TechnicalFact,
  TechnicalProfile,
  CatalogMatchState,
} from "@/features/installed-systems/types/installedSystem";
import { EXPIRING_SOON_WINDOW_DAYS } from "@/features/installed-systems/types/installedSystem";

import { wrapRepositoryError } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface TechnicalProfileRow {
  id: string;
  org_id: string;
  technical_identity_id: string;
  system_name: string;
  manufacturer: string;
  equipment_type: string;
  catalog_entry_ids: string[];
  match_state: string;
  match_confidence: number;
  permit_fields: unknown;
  known_facts: unknown;
  discovered_facts: unknown;
  confirmation_note: string | null;
}

interface InstalledSystemRow {
  id: string;
  org_id: string;
  technical_identity_id: string;
  technical_profile_id: string | null;
  system_name: string;
  lifecycle_status: string;
  customer_name: string;
  property_id: string | null;
  property_name: string;
  location: string;
  estimate_id: string | null;
  job_id: string | null;
  job_number: string | null;
  match_state: string;
  match_confidence: number;
  install_date: string;
  manufacturer: string;
  model_number: string;
  serial_numbers: string[];
  warranty_expiry: string;
  warranty_registered: boolean;
  warranty_registered_at: string | null;
  warranty_registered_by: string | null;
  accessories: string[];
  linked_workflow_ids: string[];
  permit_ready: boolean;
  operational_history: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapTechnicalProfile(row: TechnicalProfileRow): TechnicalProfile {
  return {
    id: row.id,
    technicalIdentityId: row.technical_identity_id,
    systemName: row.system_name,
    manufacturer: row.manufacturer,
    equipmentType: row.equipment_type,
    catalogEntryIds: row.catalog_entry_ids ?? [],
    matchState: row.match_state as CatalogMatchState,
    matchConfidence: row.match_confidence,
    permitFields: (row.permit_fields as TechnicalProfile["permitFields"]) ?? {},
    knownFacts: (row.known_facts as TechnicalFact[]) ?? [],
    discoveredFacts: (row.discovered_facts as TechnicalFact[]) ?? [],
    confirmationNote: row.confirmation_note ?? undefined,
  };
}

function mapInstalledSystem(row: InstalledSystemRow): InstalledSystem {
  return {
    id: row.id,
    technicalIdentityId: row.technical_identity_id,
    technicalProfileId: row.technical_profile_id ?? "",
    systemName: row.system_name,
    lifecycleStatus: row.lifecycle_status as InstalledSystemLifecycle,
    customerName: row.customer_name,
    propertyId: row.property_id ?? undefined,
    propertyName: row.property_name,
    location: row.location,
    estimateId: row.estimate_id ?? undefined,
    jobId: row.job_id ?? undefined,
    jobNumber: row.job_number ?? undefined,
    matchState: row.match_state as CatalogMatchState,
    matchConfidence: row.match_confidence,
    installDate: row.install_date,
    manufacturer: row.manufacturer ?? "",
    modelNumber: row.model_number ?? "",
    serialNumbers: row.serial_numbers ?? [],
    warrantyExpiry: row.warranty_expiry ?? "",
    warrantyRegistered: row.warranty_registered ?? false,
    warrantyRegisteredAt: row.warranty_registered_at ?? undefined,
    warrantyRegisteredBy: row.warranty_registered_by ?? undefined,
    accessories: row.accessories ?? [],
    linkedWorkflowIds: row.linked_workflow_ids ?? [],
    permitReady: row.permit_ready,
    operationalHistory: row.operational_history ?? [],
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listInstalledSystems(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("installed_systems")
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as InstalledSystemRow[]).map(mapInstalledSystem);
  });
}

export async function getInstalledSystemById(id: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("installed_systems")
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapInstalledSystem(data as InstalledSystemRow) : null;
  });
}

export async function listInstalledSystemsByProperty(propertyId: string, options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("installed_systems")
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as InstalledSystemRow[]).map(mapInstalledSystem);
  });
}

export async function listTechnicalProfiles(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("technical_profiles")
      .select(
        "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note"
      )
      .eq("org_id", orgId)
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as TechnicalProfileRow[]).map(mapTechnicalProfile);
  });
}

// ---------------------------------------------------------------------------
// Write input types
// ---------------------------------------------------------------------------

export type TechnicalProfileWriteInput = Omit<TechnicalProfile, "id">;
export type InstalledSystemWriteInput = Omit<InstalledSystem, "id">;

export async function upsertTechnicalProfile(id: string | undefined, input: TechnicalProfileWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();

    const row = {
      org_id: orgId,
      technical_identity_id: input.technicalIdentityId,
      system_name: input.systemName,
      manufacturer: input.manufacturer,
      equipment_type: input.equipmentType,
      catalog_entry_ids: input.catalogEntryIds,
      match_state: input.matchState,
      match_confidence: input.matchConfidence,
      permit_fields: input.permitFields,
      known_facts: input.knownFacts,
      discovered_facts: input.discoveredFacts,
      confirmation_note: input.confirmationNote ?? null,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await supabase
        .from("technical_profiles")
        .update(row)
        .eq("org_id", orgId)
        .eq("id", id)
        .select(
          "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note"
        )
        .single();
      if (error) throw new Error(error.message);
      return mapTechnicalProfile(data as TechnicalProfileRow);
    }

    const { data, error } = await supabase
      .from("technical_profiles")
      .insert(row)
      .select(
        "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note"
      )
      .single();
    if (error) throw new Error(error.message);
    return mapTechnicalProfile(data as TechnicalProfileRow);
  });
}

export async function upsertInstalledSystem(id: string | undefined, input: InstalledSystemWriteInput) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();

    const row = {
      org_id: orgId,
      technical_identity_id: input.technicalIdentityId,
      technical_profile_id: input.technicalProfileId || null,
      system_name: input.systemName,
      lifecycle_status: input.lifecycleStatus,
      customer_name: input.customerName,
      property_id: input.propertyId ?? null,
      property_name: input.propertyName,
      location: input.location,
      estimate_id: input.estimateId ?? null,
      job_id: input.jobId ?? null,
      job_number: input.jobNumber ?? null,
      match_state: input.matchState,
      match_confidence: input.matchConfidence,
      install_date: input.installDate,
      manufacturer: input.manufacturer,
      model_number: input.modelNumber,
      serial_numbers: input.serialNumbers,
      warranty_expiry: input.warrantyExpiry,
      warranty_registered: input.warrantyRegistered ?? false,
      warranty_registered_at: input.warrantyRegisteredAt ?? null,
      warranty_registered_by: input.warrantyRegisteredBy ?? null,
      accessories: input.accessories,
      linked_workflow_ids: input.linkedWorkflowIds,
      permit_ready: input.permitReady,
      operational_history: input.operationalHistory,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await supabase
        .from("installed_systems")
        .update(row)
        .eq("org_id", orgId)
        .eq("id", id)
        .select(
          "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
        )
        .single();
      if (error) throw new Error(error.message);
      return mapInstalledSystem(data as InstalledSystemRow);
    }

    const { data, error } = await supabase
      .from("installed_systems")
      .insert(row)
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .single();
    if (error) throw new Error(error.message);
    return mapInstalledSystem(data as InstalledSystemRow);
  });
}

export async function deleteInstalledSystem(id: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { error } = await supabase
      .from("installed_systems")
      .delete()
      .eq("org_id", orgId)
      .eq("id", id);

    if (error) throw new Error(error.message);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Snapshot load
// ---------------------------------------------------------------------------

export interface InstalledSystemsRepositorySnapshot {
  installedSystems: InstalledSystem[];
  technicalProfiles: TechnicalProfile[];
  counts: InstalledSystemsCounts;
}

const INSTALLED_SYSTEM_COLUMNS =
  "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,manufacturer,model_number,serial_numbers,warranty_expiry,warranty_registered,warranty_registered_at,warranty_registered_by,accessories,linked_workflow_ids,permit_ready,operational_history,created_at";

const TECHNICAL_PROFILE_COLUMNS =
  "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note";

// Supabase/PostgREST silently caps an unranged select at 1,000 rows. Fetch in
// fixed pages until a short page proves the table is exhausted, so a large org
// (thousands of installed systems) is never silently truncated to the first
// page. This is the read side only — it does not change any warranty write rule.
const FETCH_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + FETCH_PAGE_SIZE - 1;
    const { data, error } = await runPage(from, to);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return rows;
}

function isoDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Exact, org-scoped tile counts computed entirely in the database with
 * `count: "exact", head: true` queries — never the `.length` of a page that
 * PostgREST may have capped at 1,000 rows. `warranty_expiry` is a fixed
 * `YYYY-MM-DD` text column, so lexicographic `>=` / `<` / `<=` comparisons
 * against ISO date strings are equivalent to calendar comparisons. Empty and
 * NULL expiries are excluded from every warranty bucket.
 */
export async function loadInstalledSystemsCounts(): Promise<InstalledSystemsCounts> {
  const { supabase, orgId } = await getRepositoryContext();
  const today = isoDateDaysFromNow(0);
  const soonCutoff = isoDateDaysFromNow(EXPIRING_SOON_WINDOW_DAYS);

  const [totalRes, activeRes, expiringRes, expiredRes] = await Promise.all([
    supabase
      .from("installed_systems")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("installed_systems")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("warranty_expiry", "")
      .gte("warranty_expiry", today),
    supabase
      .from("installed_systems")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("warranty_expiry", "")
      .gte("warranty_expiry", today)
      .lte("warranty_expiry", soonCutoff),
    supabase
      .from("installed_systems")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("warranty_expiry", "")
      .lt("warranty_expiry", today),
  ]);

  if (totalRes.error) throw new Error(totalRes.error.message);
  if (activeRes.error) throw new Error(activeRes.error.message);
  if (expiringRes.error) throw new Error(expiringRes.error.message);
  if (expiredRes.error) throw new Error(expiredRes.error.message);

  return {
    total: totalRes.count ?? 0,
    activeWarranties: activeRes.count ?? 0,
    expiringSoon: expiringRes.count ?? 0,
    expired: expiredRes.count ?? 0,
  };
}

export async function loadInstalledSystemsSnapshot(): Promise<InstalledSystemsRepositorySnapshot> {
  const { supabase, orgId } = await getRepositoryContext();

  const [systemRows, profileRows, counts] = await Promise.all([
    fetchAllRows<InstalledSystemRow>((from, to) =>
      supabase
        .from("installed_systems")
        .select(INSTALLED_SYSTEM_COLUMNS)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<TechnicalProfileRow>((from, to) =>
      supabase
        .from("technical_profiles")
        .select(TECHNICAL_PROFILE_COLUMNS)
        .eq("org_id", orgId)
        .range(from, to)
    ),
    loadInstalledSystemsCounts(),
  ]);

  return {
    installedSystems: systemRows.map(mapInstalledSystem),
    technicalProfiles: profileRows.map(mapTechnicalProfile),
    counts,
  };
}

// ---------------------------------------------------------------------------
// Scoped loads (Bundle C perf pass)
//
// The org-wide snapshot above reads EVERY installed system (2,778 live rows,
// three sequential 1,000-row pages) plus all technical profiles and four
// count queries. Job and customer screens only ever show a handful, so they
// use these scoped reads instead.
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids per `.in()` request — keeps the PostgREST URL short. */
const SCOPED_ID_CHUNK_SIZE = 80;

export function isInstalledSystemsScopeId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface InstalledSystemsScopedSnapshot {
  installedSystems: InstalledSystem[];
  technicalProfiles: TechnicalProfile[];
}

async function loadTechnicalProfilesByIds(
  supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"],
  orgId: string,
  ids: string[],
): Promise<TechnicalProfile[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += SCOPED_ID_CHUNK_SIZE) {
    chunks.push(unique.slice(index, index + SCOPED_ID_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchAllRows<TechnicalProfileRow>((from, to) =>
        supabase
          .from("technical_profiles")
          .select(TECHNICAL_PROFILE_COLUMNS)
          .eq("org_id", orgId)
          .in("id", chunk)
          .range(from, to),
      ),
    ),
  );
  return pages.flat().map(mapTechnicalProfile);
}

/**
 * Installed systems that belong to ONE job — the same rule the job Systems
 * panel applies client-side (getInstalledSystemsForJob): `job_id` is the job,
 * or the job id is in `linked_workflow_ids`. Plus only the technical profiles
 * those systems reference.
 */
export async function loadInstalledSystemsForJob(
  jobId: string,
): Promise<InstalledSystemsScopedSnapshot> {
  if (!isInstalledSystemsScopeId(jobId)) {
    throw Object.assign(new Error("Invalid job id."), { status: 400 });
  }
  const { supabase, orgId } = await getRepositoryContext();

  const systemRows = await fetchAllRows<InstalledSystemRow>((from, to) =>
    supabase
      .from("installed_systems")
      .select(INSTALLED_SYSTEM_COLUMNS)
      .eq("org_id", orgId)
      // jobId is validated as a UUID above, so it is safe inside the filter.
      .or(`job_id.eq.${jobId},linked_workflow_ids.cs.{${jobId}}`)
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  const technicalProfiles = await loadTechnicalProfilesByIds(
    supabase,
    orgId,
    systemRows.map((row) => row.technical_profile_id ?? ""),
  );

  return { installedSystems: systemRows.map(mapInstalledSystem), technicalProfiles };
}

/**
 * Installed systems on a set of properties (the customer detail Systems
 * tab). Chunked `.in("property_id", …)` reads run in parallel and each chunk
 * is paged, so nothing is silently capped at 1,000 rows.
 */
export async function listInstalledSystemsForProperties(
  propertyIds: string[],
): Promise<InstalledSystem[]> {
  const unique = [...new Set(propertyIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();

  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += SCOPED_ID_CHUNK_SIZE) {
    chunks.push(unique.slice(index, index + SCOPED_ID_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchAllRows<InstalledSystemRow>((from, to) =>
        supabase
          .from("installed_systems")
          .select(INSTALLED_SYSTEM_COLUMNS)
          .eq("org_id", orgId)
          .in("property_id", chunk)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
    ),
  );

  return pages
    .flat()
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .map(mapInstalledSystem);
}
