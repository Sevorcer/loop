/**
 * Portal Issue/Request Submission API — GC Portal Task 4
 *
 * POST /api/portal/[token]/submit — submit an issue or request
 *
 * Access: public (token is the sole authorization).
 * Rate-limited per token to prevent abuse.
 *
 * Body: { name: string, contact?: string, message: string }
 */

import { NextResponse } from "next/server";

import { resolveShareToken } from "@/services/jobShareLinks";
import { createRateLimiter } from "@/lib/security/rateLimit";

// Rate limit: 5 submissions per token per 15 minutes
const submissionLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Validate token
  const resolved = await resolveShareToken(token);
  if (!resolved) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Invalid or expired share link.", code: 404 },
      { status: 404 },
    );
  }

  // Rate limit per token
  const rateLimitResponse = submissionLimiter.check(token);
  if (rateLimitResponse) return rateLimitResponse;

  // Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Request body must be valid JSON.", code: 400 },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Name is required.", code: 400 },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Message is required.", code: 400 },
      { status: 400 },
    );
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Message must be 5000 characters or less.", code: 400 },
      { status: 400 },
    );
  }

  try {
    // Use admin client for public (unauthenticated) portal access
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "INTERNAL_SERVER_ERROR", message: "Service unavailable.", code: 500 },
        { status: 500 },
      );
    }

    const { data, error } = await admin
      .from("portal_submissions")
      .insert({
        org_id: resolved.orgId,
        job_id: resolved.jobId,
        share_link_id: resolved.id,
        name,
        contact,
        message,
        // Untyped admin client: portal_submissions is not in the generated
        // types, so the insert payload resolves to never[] without the cast.
      } as never)
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "INTERNAL_SERVER_ERROR", message: "Failed to save submission.", code: 500 },
        { status: 500 },
      );
    }

    const row = data as Record<string, unknown>;
    return NextResponse.json(
      {
        submission: {
          id: row.id,
          createdAt: row.created_at,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Failed to process submission.", code: 500 },
      { status: 500 },
    );
  }
}
