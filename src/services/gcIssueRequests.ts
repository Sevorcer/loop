import "server-only";

/**
 * GC issue request service — Sprint 27 #57
 *
 * Business logic for the GC field issue request workflow.
 * Enforces status machine transitions and input validation.
 *
 * Architecture: UI → Hooks → Services → Repositories → Supabase
 */

import type {
  CreateGcIssueRequestInput,
  GcIssuePriority,
  GcIssueRequest,
  GcIssueStatus,
  UpdateGcIssueRequestInput,
} from "@/features/gc-field-issues/types/gcIssueRequest";
import { ISSUE_STATUS_TRANSITIONS } from "@/features/gc-field-issues/types/gcIssueRequest";

import {
  addAttachment,
  createGcIssueRequest as createRecord,
  deleteGcIssueRequest as deleteRecord,
  getGcIssueRequestById,
  listAttachmentIds,
  listGcIssueRequests as listRecords,
  updateGcIssueRequest as updateRecord,
} from "@/repositories/gcIssueRequests";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PRIORITIES = new Set<GcIssuePriority>(["low", "medium", "high", "critical"]);
const VALID_STATUSES = new Set<GcIssueStatus>(["open", "triaged", "in_progress", "resolved", "closed"]);

// ─── Validation ───────────────────────────────────────────────────────────────

function validateCreateInput(input: CreateGcIssueRequestInput) {
  if (!input.title?.trim()) throw new Error("Issue title is required.");
  if (!VALID_PRIORITIES.has(input.priority)) throw new Error("Invalid priority value.");
}

function validateStatusTransition(currentStatus: GcIssueStatus, nextStatus: GcIssueStatus) {
  const allowed = ISSUE_STATUS_TRANSITIONS[currentStatus];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid status transition: '${currentStatus}' → '${nextStatus}'. ` +
      `Allowed transitions: ${allowed.join(", ") || "none"}.`,
    );
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listGcIssueRequests(filter?: {
  status?: GcIssueStatus;
  priority?: GcIssuePriority;
  jobId?: string;
  propertyId?: string;
}): Promise<GcIssueRequest[]> {
  return listRecords(filter);
}

export async function getGcIssueRequest(id: string): Promise<GcIssueRequest | null> {
  const issue = await getGcIssueRequestById(id);
  if (!issue) return null;

  const attachmentIds = await listAttachmentIds(id);
  return { ...issue, attachmentIds };
}

export async function createGcIssueRequest(
  input: CreateGcIssueRequestInput,
  submittedByUserId?: string,
): Promise<GcIssueRequest> {
  validateCreateInput(input);

  const normalizedInput = {
    ...input,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
  };

  const issue = await createRecord(normalizedInput, submittedByUserId);

  // Attach any storage objects provided at creation time
  if (input.attachmentIds?.length) {
    await Promise.all(
      input.attachmentIds.map((sid) => addAttachment(issue.id, sid)),
    );
  }

  return issue;
}

export async function updateGcIssueRequest(
  id: string,
  input: UpdateGcIssueRequestInput,
): Promise<GcIssueRequest> {
  // Validate status transition if status is being changed
  if (input.status) {
    const current = await getGcIssueRequestById(id);
    if (!current) throw new Error("GC issue request not found.");
    if (!VALID_STATUSES.has(input.status)) throw new Error("Invalid status value.");
    validateStatusTransition(current.status, input.status);
  }

  if (input.priority && !VALID_PRIORITIES.has(input.priority)) {
    throw new Error("Invalid priority value.");
  }

  // Auto-set resolved_at when status moves to resolved
  const patch: UpdateGcIssueRequestInput = { ...input };
  if (input.status === "resolved" && !input.resolvedAt) {
    patch.resolvedAt = new Date().toISOString();
  }
  // Clear resolved_at if re-opening
  if (input.status && input.status !== "resolved" && input.status !== "closed") {
    patch.resolvedAt = null;
  }

  return updateRecord(id, patch);
}

export async function deleteGcIssueRequest(id: string): Promise<void> {
  await deleteRecord(id);
}

export async function attachFileToIssue(
  issueId: string,
  storageObjectId: string,
): Promise<void> {
  // Verify issue exists
  const issue = await getGcIssueRequestById(issueId);
  if (!issue) throw new Error("GC issue request not found.");

  await addAttachment(issueId, storageObjectId);
}
