import { NextResponse } from "next/server";

import { runDbHealthChecks } from "@/services/dbHealth";
import type { RunTrigger } from "@/features/admin/db-health/types";

/**
 * POST /api/admin/db-health/check
 *
 * Triggers a DB health check run, persists results, and returns a summary.
 * Authenticated by the LOOP_HEALTH_CHECK_TOKEN bearer token — intended for
 * CI automation (GitHub Actions daily cron and pre-deploy gate).
 *
 * Auth: ****** compared against LOOP_HEALTH_CHECK_TOKEN env var.
 *       This route is listed in EXEMPT_ROUTES in api-route-authz-coverage.test.ts
 *       because it uses its own bearer-token auth, not the session-based
 *       requirePermission / requireApiSession primitives.
 *
 * Request body (JSON):
 *   trigger   — "scheduled" | "manual" | "pre_deploy"
 *   ciRunUrl  — URL of the GitHub Actions run (context link)
 *   gitSha    — Git commit SHA at the time of the check
 *   expectedMigrationCount — number of migrations that should be applied
 */
export async function POST(request: Request) {
  // ── Token auth ─────────────────────────────────────────────────────────────
  const token = process.env.LOOP_HEALTH_CHECK_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "DB health check endpoint is not configured on this environment." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const supplied = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!supplied || supplied !== token) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validTriggers: RunTrigger[] = ["scheduled", "manual", "pre_deploy"];
  const trigger: RunTrigger =
    typeof body.trigger === "string" && validTriggers.includes(body.trigger as RunTrigger)
      ? (body.trigger as RunTrigger)
      : "manual";

  const ciRunUrl =
    typeof body.ciRunUrl === "string" && body.ciRunUrl.startsWith("https://")
      ? body.ciRunUrl
      : null;

  const gitSha =
    typeof body.gitSha === "string" && /^[0-9a-f]{7,40}$/i.test(body.gitSha)
      ? body.gitSha
      : null;

  const expectedMigrationCount =
    typeof body.expectedMigrationCount === "number" && body.expectedMigrationCount > 0
      ? body.expectedMigrationCount
      : undefined;

  // ── Run checks ─────────────────────────────────────────────────────────────
  try {
    const result = await runDbHealthChecks({
      trigger,
      ciRunUrl,
      gitSha,
      expectedMigrationCount,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Health check run failed: ${message}` },
      { status: 500 },
    );
  }
}
