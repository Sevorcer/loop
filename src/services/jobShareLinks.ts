import "server-only";

/**
 * Job Share Links service — GC Portal Task 1
 *
 * Manages per-job share links for builder portal access.
 * Tokens are generated as crypto-random hex strings and only their
 * SHA-256 hashes are stored. The raw token is returned once on creation.
 */

import { createHash, randomBytes } from "crypto";

import { getRepositoryContext } from "@/repositories/supabaseContext";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobShareLink {
  id: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateShareLinkResult {
  link: JobShareLink;
  /** Raw token — shown once, never stored. */
  token: string;
}

export interface ResolvedShareLink {
  id: string;
  orgId: string;
  jobId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf-8").digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

interface ShareLinkRow {
  id: string;
  org_id: string;
  job_id: string;
  token_hash: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

function mapRow(row: ShareLinkRow): JobShareLink {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a share link for a job. Revokes any existing active link first.
 */
export async function createJobShareLink(
  jobId: string,
  userId: string,
  input?: SessionRepositoryContextInput,
): Promise<CreateShareLinkResult> {
  const ctx = await getRepositoryContext(input);
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Revoke any existing active link for this job
  await ctx.supabase
    .from("job_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("org_id", ctx.orgId)
    .eq("job_id", jobId)
    .is("revoked_at", null);

  // Create the new link
  const { data, error } = await ctx.supabase
    .from("job_share_links")
    .insert({
      org_id: ctx.orgId,
      job_id: jobId,
      token_hash: tokenHash,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return { link: mapRow(data as ShareLinkRow), token };
}

/**
 * Revoke the active share link for a job.
 */
export async function revokeJobShareLink(
  jobId: string,
  input?: SessionRepositoryContextInput,
): Promise<void> {
  const ctx = await getRepositoryContext(input);

  const { error } = await ctx.supabase
    .from("job_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("org_id", ctx.orgId)
    .eq("job_id", jobId)
    .is("revoked_at", null);

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }
}

/**
 * Get the active share link for a job (without the raw token).
 */
export async function getActiveShareLink(
  jobId: string,
  input?: SessionRepositoryContextInput,
): Promise<JobShareLink | null> {
  const ctx = await getRepositoryContext(input);

  const { data, error } = await ctx.supabase
    .from("job_share_links")
    .select()
    .eq("org_id", ctx.orgId)
    .eq("job_id", jobId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return data ? mapRow(data as ShareLinkRow) : null;
}

/**
 * Resolve a raw token to its job scope. Used by the public portal endpoint.
 *
 * Uses SHA-256 hashing and then standard DB equality check on the hash.
 * The token itself is never sent to the database.
 */
export async function resolveShareToken(
  token: string,
): Promise<ResolvedShareLink | null> {
  if (!token || token.length !== 64) return null;

  const tokenHash = hashToken(token);

  // Use admin client for public (unauthenticated) portal access
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("job_share_links")
    .select("id, org_id, job_id, token_hash")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { id: string; org_id: string; job_id: string; token_hash: string };

  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
  };
}
