import "server-only";

/**
 * Installed systems repository — Sprint 27 #58
 *
 * Provides list/get operations for the installed_systems table.
 * Replaces seedInstalledSystems mock in production paths.
 */

import { getRepositoryContext } from "./supabaseContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstalledSystemRow {
  id: string;
  org_id: string;
  property_id: string | null;
  job_id: string | null;
  system_name: string;
  customer_name: string;
  property_name: string;
  location: string;
  lifecycle_status: string;
  serial_numbers: string[];
  equipment_type: string;
  manufacturer: string;
  model_number: string;
  install_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstalledSystemRecord {
  id: string;
  propertyId: string | null;
  jobId: string | null;
  systemName: string;
  customerName: string;
  propertyName: string;
  location: string;
  lifecycleStatus: string;
  serialNumbers: string[];
  equipmentType: string;
  manufacturer: string;
  modelNumber: string;
  installDate: string | null;
}

function mapRow(row: InstalledSystemRow): InstalledSystemRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    jobId: row.job_id,
    systemName: row.system_name,
    customerName: row.customer_name,
    propertyName: row.property_name,
    location: row.location,
    lifecycleStatus: row.lifecycle_status,
    serialNumbers: row.serial_numbers,
    equipmentType: row.equipment_type,
    manufacturer: row.manufacturer,
    modelNumber: row.model_number,
    installDate: row.install_date,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listInstalledSystems(filter?: {
  propertyId?: string;
  jobId?: string;
}): Promise<InstalledSystemRecord[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("installed_systems")
    .select(
      "id,org_id,property_id,job_id,system_name,customer_name,property_name,location,lifecycle_status,serial_numbers,equipment_type,manufacturer,model_number,install_date,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("system_name", { ascending: true });

  if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter?.jobId) query = query.eq("job_id", filter.jobId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as InstalledSystemRow[]).map(mapRow);
}

export async function getInstalledSystemById(id: string): Promise<InstalledSystemRecord | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("installed_systems")
    .select(
      "id,org_id,property_id,job_id,system_name,customer_name,property_name,location,lifecycle_status,serial_numbers,equipment_type,manufacturer,model_number,install_date,created_at,updated_at",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapRow(data as InstalledSystemRow);
}
