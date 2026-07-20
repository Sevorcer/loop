import "server-only";

/**
 * GC issue request repository — Sprint 27 #57
 *
 * CRUD operations for gc_issue_requests and gc_issue_attachments tables.
 * All queries are scoped to org_id via getRepositoryContext().
 */

import type {
  GcIssueRequest,
  GcIssuePriority,
  GcIssueStatus,
} from "@/features/gc-field-issues/types/gcIssueRequest";

import { getRepositoryContext } from "./supabaseContext";

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface GcIssueRequestRow {
  id: string;
  org_id: string;
  title: string;
  description: string;
  priority: GcIssuePriority;
  status: GcIssueStatus;
  property_id: string | null;
  job_id: string | null;
  submitted_by: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: GcIssueRequestRow): GcIssueRequest {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    propertyId: row.property_id,
    jobId: row.job_id,
    submittedBy: row.submitted_by,
    assignedTo: row.assigned_to,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Write input ──────────────────────────────────────────────────────────────

export interface GcIssueRequestWriteInput {
  title: string;
  description: string;
  priority: GcIssuePriority;
  propertyId?: string | null;
  jobId?: string | null;
  assignedTo?: string | null;
  status?: GcIssueStatus;
  resolvedAt?: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listGcIssueRequests(filter?: {
  status?: GcIssueStatus;
  priority?: GcIssuePriority;
  jobId?: string;
  propertyId?: string;
}): Promise<GcIssueRequest[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("gc_issue_requests")
    .select(
      "id,org_id,title,description,priority,status,property_id,job_id,submitted_by,assigned_to,resolved_at,created_at,updated_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.priority) query = query.eq("priority", filter.priority);
  if (filter?.jobId) query = query.eq("job_id", filter.jobId);
  if (filter?.propertyId) query = query.eq("property_id", filter.propertyId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data as GcIssueRequestRow[]).map(mapRow);
}

export async function getGcIssueRequestById(id: string): Promise<GcIssueRequest | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("gc_issue_requests")
    .select(
      "id,org_id,title,description,priority,status,property_id,job_id,submitted_by,assigned_to,resolved_at,created_at,updated_at",
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapRow(data as GcIssueRequestRow);
}

export async function createGcIssueRequest(
  input: GcIssueRequestWriteInput,
  submittedByUserId?: string,
): Promise<GcIssueRequest> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("gc_issue_requests")
    .insert({
      org_id: orgId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "open",
      property_id: input.propertyId ?? null,
      job_id: input.jobId ?? null,
      submitted_by: submittedByUserId ?? null,
      assigned_to: null,
    })
    .select("id,org_id,title,description,priority,status,property_id,job_id,submitted_by,assigned_to,resolved_at,created_at,updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create GC issue request.");
  }

  return mapRow(data as GcIssueRequestRow);
}

export async function updateGcIssueRequest(
  id: string,
  input: Partial<GcIssueRequestWriteInput>,
): Promise<GcIssueRequest> {
  const { supabase, orgId } = await getRepositoryContext();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if ("propertyId" in input) patch.property_id = input.propertyId ?? null;
  if ("jobId" in input) patch.job_id = input.jobId ?? null;
  if ("assignedTo" in input) patch.assigned_to = input.assignedTo ?? null;
  if ("resolvedAt" in input) patch.resolved_at = input.resolvedAt ?? null;

  const { data, error } = await supabase
    .from("gc_issue_requests")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id,org_id,title,description,priority,status,property_id,job_id,submitted_by,assigned_to,resolved_at,created_at,updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "GC issue request not found.");
  }

  return mapRow(data as GcIssueRequestRow);
}

export async function deleteGcIssueRequest(id: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("gc_issue_requests")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function addAttachment(
  issueRequestId: string,
  storageObjectId: string,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase.from("gc_issue_attachments").insert({
    org_id: orgId,
    issue_request_id: issueRequestId,
    storage_object_id: storageObjectId,
  });

  if (error) throw new Error(error.message);
}

export async function listAttachmentIds(issueRequestId: string): Promise<string[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("gc_issue_attachments")
    .select("storage_object_id")
    .eq("issue_request_id", issueRequestId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  return (data as Array<{ storage_object_id: string }>).map((row) => row.storage_object_id);
}
