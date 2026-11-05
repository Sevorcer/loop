import "server-only";

import type {
  DriveListedFile,
  DriveManualFile,
  DriveManualSyncRun,
  ManualDocType,
  ParsedManualName,
} from "@/features/manuals/types/manuals";
import { MANUAL_DOC_TYPES } from "@/features/manuals/types/manuals";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// drive_manual_files / drive_manual_sync_runs (20261121100000) — #33.
//
// Metadata + links only. updated_at / updated_by are stamped by trigger.
// The sync never writes manufacturer_override / model_override.
// ---------------------------------------------------------------------------

export interface DriveManualFileRow {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string;
  folder_path: string;
  drive_modified_at: string | null;
  web_view_link: string;
  size_bytes: number | string | null;
  parsed_manufacturer: string | null;
  parsed_manufacturers: string[] | null;
  parsed_models: string[] | null;
  parsed_doc_type: string;
  manufacturer_override: string | null;
  model_override: string | null;
  status: string;
  /** 20261121500000; absent on rows read before that migration. */
  portal_eligible?: boolean | null;
  /** 20261124000000; object path inside the private `manuals` bucket, null = Drive link only. */
  storage_path?: string | null;
  last_seen_at: string;
  updated_at: string;
}

interface SyncRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  folder_count: number;
  files_seen: number;
  files_added: number;
  files_updated: number;
  files_removed: number;
  error: string | null;
}

export const DRIVE_MANUAL_COLUMNS =
  "id,drive_file_id,name,mime_type,folder_path,drive_modified_at,web_view_link,size_bytes,parsed_manufacturer,parsed_manufacturers,parsed_models,parsed_doc_type,manufacturer_override,model_override,status,portal_eligible,storage_path,last_seen_at,updated_at";

const SYNC_RUN_COLUMNS =
  "id,started_at,finished_at,status,folder_count,files_seen,files_added,files_updated,files_removed,error";

const PAGE_SIZE = 500;
const ID_CHUNK = 80;
const UPSERT_CHUNK = 200;

function isDocType(value: string): value is ManualDocType {
  return (MANUAL_DOC_TYPES as readonly string[]).includes(value);
}

export function mapDriveManualFile(row: DriveManualFileRow): DriveManualFile {
  const parsedModels = row.parsed_models ?? [];
  const size = row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes);
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    name: row.name,
    mimeType: row.mime_type ?? "",
    folderPath: row.folder_path ?? "",
    driveModifiedAt: row.drive_modified_at ?? null,
    webViewLink: row.web_view_link ?? "",
    sizeBytes: size !== null && Number.isFinite(size) ? size : null,
    parsedManufacturer: row.parsed_manufacturer ?? null,
    parsedManufacturers: row.parsed_manufacturers ?? [],
    parsedModels,
    docType: isDocType(row.parsed_doc_type) ? row.parsed_doc_type : "other",
    manufacturerOverride: row.manufacturer_override ?? null,
    modelOverride: row.model_override ?? null,
    manufacturer: row.manufacturer_override?.trim() || row.parsed_manufacturer || null,
    models: row.model_override?.trim() ? [row.model_override.trim().toUpperCase()] : parsedModels,
    status: row.status === "removed" ? "removed" : "active",
    portalEligible: row.portal_eligible === true,
    hasLocalFile: !!row.storage_path,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}

function mapSyncRun(row: SyncRunRow): DriveManualSyncRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status === "ok" || row.status === "error" ? row.status : "running",
    folderCount: row.folder_count ?? 0,
    filesSeen: row.files_seen ?? 0,
    filesAdded: row.files_added ?? 0,
    filesUpdated: row.files_updated ?? 0,
    filesRemoved: row.files_removed ?? 0,
    error: row.error ?? null,
  };
}

function toRepositoryError(error: { message: string; code?: string }) {
  if (error.code === "42501") {
    return Object.assign(new Error(error.message), { status: 403, code: "FORBIDDEN" });
  }
  return new Error(error.message);
}

export async function listDriveManualFiles(
  options: { includeRemoved?: boolean } = {},
): Promise<DriveManualFile[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const rows: DriveManualFileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("drive_manual_files").select(DRIVE_MANUAL_COLUMNS).eq("org_id", orgId);
    if (!options.includeRemoved) query = query.eq("status", "active");
    const { data, error } = await query
      .order("folder_path", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw toRepositoryError(error);
    const page = (data ?? []) as DriveManualFileRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.map(mapDriveManualFile);
}

/** Existing index rows keyed by Drive file id (for add / update / remove counts). */
export async function listIndexedDriveFileIds(): Promise<Map<string, { id: string; status: string }>> {
  const { supabase, orgId } = await getRepositoryContext();
  const out = new Map<string, { id: string; status: string }>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("drive_manual_files")
      .select("id,drive_file_id,status")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw toRepositoryError(error);
    const page = (data ?? []) as Array<{ id: string; drive_file_id: string; status: string }>;
    for (const row of page) out.set(row.drive_file_id, { id: row.id, status: row.status });
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

export async function upsertDriveManualFiles(
  files: Array<{ listed: DriveListedFile; parsed: ParsedManualName }>,
  seenAt: string,
): Promise<void> {
  if (files.length === 0) return;
  const { supabase, orgId } = await getRepositoryContext();
  for (let i = 0; i < files.length; i += UPSERT_CHUNK) {
    const chunk = files.slice(i, i + UPSERT_CHUNK).map(({ listed, parsed }) => ({
      org_id: orgId,
      drive_file_id: listed.driveFileId,
      name: listed.name.slice(0, 500),
      mime_type: listed.mimeType.slice(0, 200),
      folder_path: listed.folderPath.slice(0, 1000),
      root_folder_id: listed.rootFolderId,
      parent_folder_id: listed.parentFolderId,
      drive_modified_at: listed.modifiedTime,
      web_view_link: listed.webViewLink,
      size_bytes: listed.sizeBytes,
      parsed_manufacturer: parsed.manufacturer,
      parsed_manufacturers: parsed.manufacturers,
      parsed_models: parsed.models,
      parsed_doc_type: parsed.docType,
      portal_eligible: listed.portalEligible === true,
      status: "active",
      last_seen_at: seenAt,
    }));
    const { error } = await supabase
      .from("drive_manual_files")
      .upsert(chunk, { onConflict: "org_id,drive_file_id" });
    if (error) throw toRepositoryError(error);
  }
}

/** Mark index rows whose Drive file was not seen this sync as removed. */
export async function markDriveManualFilesRemoved(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { supabase, orgId } = await getRepositoryContext();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { error } = await supabase
      .from("drive_manual_files")
      .update({ status: "removed" })
      .eq("org_id", orgId)
      .in("id", ids.slice(i, i + ID_CHUNK));
    if (error) throw toRepositoryError(error);
  }
}

export async function updateDriveManualOverrides(
  id: string,
  patch: { manufacturerOverride?: string | null; modelOverride?: string | null },
): Promise<DriveManualFile> {
  const { supabase, orgId } = await getRepositoryContext();
  const update: Record<string, string | null> = {};
  if (patch.manufacturerOverride !== undefined) update.manufacturer_override = patch.manufacturerOverride;
  if (patch.modelOverride !== undefined) update.model_override = patch.modelOverride;
  const { data, error } = await supabase
    .from("drive_manual_files")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(DRIVE_MANUAL_COLUMNS)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  if (!data) throw Object.assign(new Error("Manual not found."), { status: 404, code: "NOT_FOUND" });
  return mapDriveManualFile(data as DriveManualFileRow);
}

/** Private Supabase Storage bucket holding the PDF copies of indexed manuals. */
export const MANUALS_BUCKET = "manuals";

/**
 * Download the stored copy of a manual (org-scoped, session client).
 *
 * Returns null when the row does not exist in this org, has no stored copy
 * (`storage_path` null), or the object is missing / unreadable. The storage
 * SELECT policy in 20261124000000 gates the bytes by role and by an existing
 * drive_manual_files row, so no service-role client is involved.
 */
export async function downloadDriveManualFile(
  id: string,
): Promise<{ blob: Blob; name: string } | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("drive_manual_files")
    .select("name,storage_path")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  const row = data as { name: string; storage_path: string | null } | null;
  if (!row?.storage_path) return null;
  const { data: blob, error: downloadError } = await supabase.storage
    .from(MANUALS_BUCKET)
    .download(row.storage_path);
  if (downloadError || !blob) return null;
  return { blob, name: row.name };
}

export async function getLatestDriveSyncRun(): Promise<DriveManualSyncRun | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("drive_manual_sync_runs")
    .select(SYNC_RUN_COLUMNS)
    .eq("org_id", orgId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  return data ? mapSyncRun(data as SyncRunRow) : null;
}

export async function startDriveSyncRun(folderCount: number): Promise<string> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("drive_manual_sync_runs")
    .insert({ org_id: orgId, folder_count: folderCount, triggered_by: userId })
    .select("id")
    .single();
  if (error) throw toRepositoryError(error);
  return (data as { id: string }).id;
}

export async function finishDriveSyncRun(
  runId: string,
  result: {
    status: "ok" | "error";
    filesSeen?: number;
    filesAdded?: number;
    filesUpdated?: number;
    filesRemoved?: number;
    error?: string | null;
  },
): Promise<DriveManualSyncRun> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("drive_manual_sync_runs")
    .update({
      status: result.status,
      finished_at: new Date().toISOString(),
      files_seen: result.filesSeen ?? 0,
      files_added: result.filesAdded ?? 0,
      files_updated: result.filesUpdated ?? 0,
      files_removed: result.filesRemoved ?? 0,
      error: result.error ? result.error.slice(0, 2000) : null,
    })
    .eq("org_id", orgId)
    .eq("id", runId)
    .select(SYNC_RUN_COLUMNS)
    .single();
  if (error) throw toRepositoryError(error);
  return mapSyncRun(data as SyncRunRow);
}
