import "server-only";

import type {
  ManualLinkSource,
  ManualLinkStatus,
  ManualMatchKind,
} from "@/features/manuals/types/manuals";

import { DRIVE_MANUAL_COLUMNS, mapDriveManualFile, type DriveManualFileRow } from "./driveManuals";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// installed_system_manuals (20261121300000) — #32.
// decided_by / decided_at are stamped by trigger. Office writes only
// source='office' rows (RLS); Copilot rows come from #8.
// ---------------------------------------------------------------------------

export interface ManualLinkRow {
  id: string;
  installed_system_id: string;
  manual_file_id: string;
  status: string;
  source: string;
  match_kind: string;
  confidence: number | string;
  reason: string;
  decided_at: string;
  manual: DriveManualFileRow | null;
}

export interface StoredManualLink {
  id: string;
  installedSystemId: string;
  manualId: string;
  status: ManualLinkStatus;
  source: ManualLinkSource;
  kind: ManualMatchKind;
  confidence: number;
  reason: string;
  decidedAt: string;
  manual: ReturnType<typeof mapDriveManualFile> | null;
}

const LINK_COLUMNS = `id,installed_system_id,manual_file_id,status,source,match_kind,confidence,reason,decided_at,manual:drive_manual_files(${DRIVE_MANUAL_COLUMNS})`;
const ID_CHUNK = 80;
const PAGE_SIZE = 500;

const STATUSES: ManualLinkStatus[] = ["confirmed", "rejected", "auto_linked", "suggested"];
const KINDS: ManualMatchKind[] = ["model_exact", "model_family", "manufacturer", "manual"];

export function mapManualLink(row: ManualLinkRow): StoredManualLink {
  const confidence = Number(row.confidence);
  return {
    id: row.id,
    installedSystemId: row.installed_system_id,
    manualId: row.manual_file_id,
    status: (STATUSES as string[]).includes(row.status) ? (row.status as ManualLinkStatus) : "suggested",
    source: row.source === "copilot" ? "copilot" : "office",
    kind: (KINDS as string[]).includes(row.match_kind) ? (row.match_kind as ManualMatchKind) : "manual",
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reason: row.reason ?? "",
    decidedAt: row.decided_at,
    manual: row.manual ? mapDriveManualFile(row.manual) : null,
  };
}

function toRepositoryError(error: { message: string; code?: string }) {
  if (error.code === "42501") {
    return Object.assign(new Error(error.message), { status: 403, code: "FORBIDDEN" });
  }
  if (error.code === "23503") {
    return Object.assign(new Error("That system or manual no longer exists."), { status: 404, code: "NOT_FOUND" });
  }
  return new Error(error.message);
}

export async function listManualLinksForSystems(systemIds: string[]): Promise<StoredManualLink[]> {
  const ids = [...new Set(systemIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const out: StoredManualLink[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("installed_system_manuals")
        .select(LINK_COLUMNS)
        .eq("org_id", orgId)
        .in("installed_system_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw toRepositoryError(error);
      const page = (data ?? []) as unknown as ManualLinkRow[];
      out.push(...page.map(mapManualLink));
      if (page.length < PAGE_SIZE) break;
    }
  }
  return out;
}

export async function upsertOfficeManualDecision(input: {
  installedSystemId: string;
  manualId: string;
  status: "confirmed" | "rejected";
  kind: ManualMatchKind;
  confidence: number;
  reason: string;
}): Promise<StoredManualLink> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("installed_system_manuals")
    .upsert(
      {
        org_id: orgId,
        installed_system_id: input.installedSystemId,
        manual_file_id: input.manualId,
        status: input.status,
        source: "office",
        match_kind: input.kind,
        confidence: Math.max(0, Math.min(1, Number(input.confidence.toFixed(3)))),
        reason: input.reason.slice(0, 500),
      },
      { onConflict: "installed_system_id,manual_file_id" },
    )
    .select(LINK_COLUMNS)
    .single();
  if (error) throw toRepositoryError(error);
  return mapManualLink(data as unknown as ManualLinkRow);
}

export async function deleteManualDecision(installedSystemId: string, manualId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("installed_system_manuals")
    .delete()
    .eq("org_id", orgId)
    .eq("installed_system_id", installedSystemId)
    .eq("manual_file_id", manualId)
    .select("id");
  if (error) throw toRepositoryError(error);
  return ((data ?? []) as unknown[]).length > 0;
}

// ─── Placement (auto-placed info) ───────────────────────────────────────────

export interface SystemPlacementRow {
  id: string;
  system_name: string;
  manufacturer: string | null;
  model_number: string | null;
  serial_numbers: string[] | null;
  install_date: string | null;
  location: string | null;
  property_id: string | null;
  job_id: string | null;
  attributes: Record<string, unknown> | null;
}

export interface PlacementJobRow {
  id: string;
  job_number: string | null;
  title: string | null;
  type: string | null;
  status: string | null;
  scheduled_for: string | null;
}

export async function loadSystemPlacementRow(systemId: string): Promise<SystemPlacementRow | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("installed_systems")
    .select("id,system_name,manufacturer,model_number,serial_numbers,install_date,location,property_id,job_id,attributes")
    .eq("org_id", orgId)
    .eq("id", systemId)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  return (data as SystemPlacementRow | null) ?? null;
}

const JOB_COLUMNS = "id,job_number,title,type,status,scheduled_for";

export async function loadJobById(jobId: string): Promise<PlacementJobRow | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", jobId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  return (data as PlacementJobRow | null) ?? null;
}

/** Install jobs at a property, newest first (RLS: a tech sees only their jobs). */
export async function listInstallJobsForProperty(propertyId: string): Promise<PlacementJobRow[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .eq("type", "Install")
    .is("deleted_at", null)
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw toRepositoryError(error);
  return (data ?? []) as PlacementJobRow[];
}
