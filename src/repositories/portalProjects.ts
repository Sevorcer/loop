import "server-only";

/**
 * Portal projects repository — Sprint 27 #58/#59
 *
 * List and get operations for portal_projects, portal_milestones,
 * portal_documents, and portal_photos tables.
 * Replaces mockPortalProjects and portal artifact fakes in production paths.
 */

import type {
  PortalProject,
  PortalMilestone,
  PortalDocument,
  PortalPhoto,
} from "@/features/project-portal/types/portalTypes";

import { getRepositoryContext } from "./supabaseContext";

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface PortalProjectRow {
  id: string;
  org_id: string;
  name: string;
  address: string;
  status: string;
  completion_pct: number;
  estimated_completion_date: string | null;
  next_milestone: string | null;
  project_manager: string;
  photos_enabled: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

interface PortalMilestoneRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  sequence: number;
  status: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PortalDocumentRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  document_type: string;
  visibility: string;
  file_size_bytes: number;
  mime_type: string;
  allowed_roles: string[] | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface PortalPhotoRow {
  id: string;
  org_id: string;
  project_id: string;
  caption: string | null;
  alt_text: string | null;
  category: string;
  visibility: string;
  url: string;
  thumbnail_url: string;
  customer_visible: boolean;
  allowed_roles: string[] | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapProject(row: PortalProjectRow): PortalProject {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    address: row.address,
    status: row.status as PortalProject["status"],
    completionPct: row.completion_pct,
    estimatedCompletionDate: row.estimated_completion_date,
    nextMilestone: row.next_milestone,
    projectManager: row.project_manager,
    photosEnabled: row.photos_enabled,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapMilestone(row: PortalMilestoneRow): PortalMilestone {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sequence: row.sequence,
    status: row.status as PortalMilestone["status"],
    completedAt: row.completed_at ?? null,
    notes: row.notes ?? null,
  };
}

function mapDocument(row: PortalDocumentRow): PortalDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    documentType: (row.document_type as PortalDocument["documentType"]) ?? "other",
    visibility: row.visibility as PortalDocument["visibility"],
    fileSizeBytes: row.file_size_bytes ?? 0,
    mimeType: row.mime_type ?? "application/octet-stream",
    publishedAt: row.published_at,
    allowedRoles: (row.allowed_roles as PortalDocument["allowedRoles"]) ?? null,
  };
}

function mapPhoto(row: PortalPhotoRow): PortalPhoto {
  return {
    id: row.id,
    projectId: row.project_id,
    caption: row.caption ?? null,
    altText: row.alt_text ?? null,
    category: (row.category as PortalPhoto["category"]) ?? "during",
    visibility: (row.visibility as PortalPhoto["visibility"]) ?? "internal",
    takenAt: row.taken_at ?? row.created_at,
    uploadedAt: row.created_at,
    url: row.url ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    allowedRoles: (row.allowed_roles as PortalPhoto["allowedRoles"]) ?? null,
  };
}

// ─── Portal projects ──────────────────────────────────────────────────────────

export async function listPortalProjects(): Promise<PortalProject[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("portal_projects")
    .select(
      "id,org_id,name,address,status,completion_pct,estimated_completion_date,next_milestone,project_manager,photos_enabled,last_synced_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as PortalProjectRow[]).map(mapProject);
}

export async function getPortalProjectById(id: string): Promise<PortalProject | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("portal_projects")
    .select(
      "id,org_id,name,address,status,completion_pct,estimated_completion_date,next_milestone,project_manager,photos_enabled,last_synced_at,created_at,updated_at",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapProject(data as PortalProjectRow);
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export async function listPortalMilestones(projectId: string): Promise<PortalMilestone[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("portal_milestones")
    .select(
      "id,org_id,project_id,name,sequence,status,completed_at,notes,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .order("sequence", { ascending: true });

  if (error) throw new Error(error.message);

  return (data as PortalMilestoneRow[]).map(mapMilestone);
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listPortalDocuments(projectId: string): Promise<PortalDocument[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("portal_documents")
    .select(
      "id,org_id,project_id,name,document_type,visibility,file_size_bytes,mime_type,allowed_roles,published_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as PortalDocumentRow[]).map(mapDocument);
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function listPortalPhotos(
  projectId: string,
  customerVisibleOnly = false,
): Promise<PortalPhoto[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("portal_photos")
    .select(
      "id,org_id,project_id,caption,alt_text,category,visibility,url,thumbnail_url,customer_visible,allowed_roles,taken_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .order("taken_at", { ascending: false });

  if (customerVisibleOnly) query = query.eq("customer_visible", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as PortalPhotoRow[]).map(mapPhoto);
}

// ─── Org-wide search helpers (for Copilot search index) ──────────────────────

/** Returns all portal documents across all projects for the org — used by Copilot search. */
export async function listAllPortalDocuments(): Promise<PortalDocument[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("portal_documents")
    .select(
      "id,org_id,project_id,name,document_type,visibility,file_size_bytes,mime_type,allowed_roles,published_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("published_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as PortalDocumentRow[]).map(mapDocument);
}

/** Returns all portal photos across all projects for the org — used by Copilot search. */
export async function listAllPortalPhotos(customerVisibleOnly = false): Promise<PortalPhoto[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("portal_photos")
    .select(
      "id,org_id,project_id,caption,alt_text,category,visibility,url,thumbnail_url,customer_visible,allowed_roles,taken_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("taken_at", { ascending: false });

  if (customerVisibleOnly) query = query.eq("customer_visible", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as PortalPhotoRow[]).map(mapPhoto);
}
