/**
 * Audit event helper — LOOP sensitive-mutation tracking.
 *
 * Every CREATE, UPDATE, or DELETE on a core resource must call
 * `emitAuditEvent` before returning a success response.
 *
 * Current implementation: structured JSON log line to stdout.
 * In production this will be replaced by a Supabase `job_activity` insert
 * (or a dedicated `audit_log` table) once the persistence layer is wired.
 *
 * Log format:
 *   [AUDIT] {"role":"owner","action":"create","resource":"jobs",...}
 */

import type { AppRole } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction = "create" | "update" | "delete";

export type AuditResource =
  | "customers"
  | "properties"
  | "jobs"
  | "dispatch"
  | "documents"
  | "contractors"
  | "job_activity"
  | "portal_users"
  | "portal_memberships"
  | "organizations";

export interface AuditEvent {
  /** The role that performed the action. */
  role: AppRole;
  /** The mutation type. */
  action: AuditAction;
  /** The resource domain being mutated. */
  resource: AuditResource;
  /** Identifier of the specific record, when known. */
  resourceId?: string;
  /** Optional structured context for richer audit trails. */
  details?: Record<string, unknown>;
  /** ISO 8601 timestamp; auto-populated when omitted. */
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

/**
 * Records a structured audit event for a sensitive mutation.
 *
 * This function is intentionally synchronous and never throws so that a
 * logging failure never blocks the request path. When Supabase persistence
 * is wired, replace the console.log with an async insert and call this
 * from a fire-and-forget wrapper inside the route handler.
 */
export function emitAuditEvent(event: AuditEvent): void {
  const entry = {
    role: event.role,
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId ?? "",
    details: event.details ?? {},
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  // Structured log for the audit trail. When Supabase persistence is wired,
  // replace this with an async insert to job_activity or audit_log.
  console.log("[AUDIT]", JSON.stringify(entry));
}
