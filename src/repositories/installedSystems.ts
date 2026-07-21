import "server-only";

import type {
  InstalledSystem,
  InstalledSystemLifecycle,
  TechnicalFact,
  TechnicalProfile,
  CatalogMatchState,
} from "@/features/installed-systems/types/installedSystem";

import { wrapRepositoryError } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

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
  serial_numbers: string[];
  accessories: string[];
  linked_workflow_ids: string[];
  permit_ready: boolean;
  operational_history: string[];
  created_at: string;
}

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
    serialNumbers: row.serial_numbers ?? [],
    accessories: row.accessories ?? [],
    linkedWorkflowIds: row.linked_workflow_ids ?? [],
    permitReady: row.permit_ready,
    operationalHistory: row.operational_history ?? [],
  };
}

export async function listInstalledSystems() {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("installed_systems")
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,serial_numbers,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

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
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,serial_numbers,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapInstalledSystem(data as InstalledSystemRow) : null;
  });
}

export async function listTechnicalProfiles() {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("technical_profiles")
      .select(
        "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note"
      )
      .eq("org_id", orgId);

    if (error) throw new Error(error.message);
    return ((data ?? []) as TechnicalProfileRow[]).map(mapTechnicalProfile);
  });
}

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
      serial_numbers: input.serialNumbers,
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
          "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,serial_numbers,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
        )
        .single();
      if (error) throw new Error(error.message);
      return mapInstalledSystem(data as InstalledSystemRow);
    }

    const { data, error } = await supabase
      .from("installed_systems")
      .insert(row)
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,serial_numbers,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .single();
    if (error) throw new Error(error.message);
    return mapInstalledSystem(data as InstalledSystemRow);
  });
}

export interface InstalledSystemsRepositorySnapshot {
  installedSystems: InstalledSystem[];
  technicalProfiles: TechnicalProfile[];
}

export async function loadInstalledSystemsSnapshot(): Promise<InstalledSystemsRepositorySnapshot> {
  const { supabase, orgId } = await getRepositoryContext();

  const [systemsRes, profilesRes] = await Promise.all([
    supabase
      .from("installed_systems")
      .select(
        "id,org_id,technical_identity_id,technical_profile_id,system_name,lifecycle_status,customer_name,property_id,property_name,location,estimate_id,job_id,job_number,match_state,match_confidence,install_date,serial_numbers,accessories,linked_workflow_ids,permit_ready,operational_history,created_at"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("technical_profiles")
      .select(
        "id,org_id,technical_identity_id,system_name,manufacturer,equipment_type,catalog_entry_ids,match_state,match_confidence,permit_fields,known_facts,discovered_facts,confirmation_note"
      )
      .eq("org_id", orgId),
  ]);

  if (systemsRes.error) throw new Error(systemsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  return {
    installedSystems: ((systemsRes.data ?? []) as InstalledSystemRow[]).map(mapInstalledSystem),
    technicalProfiles: ((profilesRes.data ?? []) as TechnicalProfileRow[]).map(mapTechnicalProfile),
  };
}