import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unauthorizedResponse } from "@/lib/api-auth";

/**
 * POST /api/admin/smoke-test
 *
 * Minimum-path application smoke test: login → create property → delete property.
 * Validates that the core user flow (auth + RLS + schema) is operational after
 * every deployment.
 *
 * Auth: bearer token compared against LOOP_HEALTH_CHECK_TOKEN — intended for
 *       CI automation (deploy gate in db-migrations.yml).
 *       This route is listed in EXEMPT_ROUTES in api-route-authz-coverage.test.ts
 *       because it uses bearer-token auth, not the session-based requirePermission.
 *
 * Request body (JSON):
 *   smokeUserEmail    — email of smoke test service account
 *   smokeUserPassword — password of smoke test service account
 *   gitSha            — (optional) git commit SHA for audit trail
 *   ciRunUrl          — (optional) CI run URL for audit trail
 *
 * Stages:
 *   1. login          — authenticate as smoke user (Supabase Auth)
 *   2. create_property — INSERT into properties (enforces INSERT RLS)
 *   3. delete_property — DELETE from properties (enforces DELETE RLS)
 *
 * Response (always HTTP 200 — check status field):
 *   { status: "pass" | "fail", failedStage, stages, nextAction, orphanPropertyId }
 */

type StageStatus = "pass" | "fail";

interface StageResult {
  stage: string;
  status: StageStatus;
  message: string;
}

interface SmokeTestResponse {
  status: "pass" | "fail";
  failedStage: string | null;
  stages: StageResult[];
  gitSha: string | null;
  ciRunUrl: string | null;
  orphanPropertyId: string | null;
  nextAction: string | null;
}

const STAGE_DIAGNOSTICS: Record<string, string> = {
  login:
    "Verify LOOP_SMOKE_USER_EMAIL / LOOP_SMOKE_USER_PASSWORD are correct, the account is active in Supabase Auth, and the user has a user_profiles row with org_id and app_role set.",
  create_property:
    "INSERT RLS policy on properties may be broken. Run: SELECT * FROM pg_policies WHERE tablename='properties' AND cmd='INSERT'; — see docs/runbooks/deploy-gate-sequence.md#rollback",
  delete_property:
    "DELETE RLS policy on properties may be broken. Run: SELECT * FROM pg_policies WHERE tablename='properties' AND cmd='DELETE'; — see docs/runbooks/deploy-gate-sequence.md#rollback",
};

function failResponse(
  failedStage: string,
  stages: StageResult[],
  gitSha: string | null,
  ciRunUrl: string | null,
  orphanPropertyId: string | null,
): NextResponse<SmokeTestResponse> {
  return NextResponse.json<SmokeTestResponse>({
    status: "fail",
    failedStage,
    stages,
    gitSha,
    ciRunUrl,
    orphanPropertyId,
    nextAction: STAGE_DIAGNOSTICS[failedStage] ?? "See docs/runbooks/deploy-gate-sequence.md",
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── Token auth ─────────────────────────────────────────────────────────────
  const token = process.env.LOOP_HEALTH_CHECK_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Smoke test endpoint is not configured on this environment." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const supplied = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!supplied || supplied !== token) {
    return unauthorizedResponse(
      "A valid bearer token is required.",
      supplied ? "invalid_token" : "missing_token",
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

  const smokeUserEmail =
    typeof body.smokeUserEmail === "string" ? body.smokeUserEmail.trim() : "";
  const smokeUserPassword =
    typeof body.smokeUserPassword === "string" ? body.smokeUserPassword : "";

  if (!smokeUserEmail || !smokeUserPassword) {
    return NextResponse.json(
      { error: "smokeUserEmail and smokeUserPassword are required." },
      { status: 400 },
    );
  }

  const gitSha =
    typeof body.gitSha === "string" && /^[0-9a-f]{7,40}$/i.test(body.gitSha)
      ? body.gitSha
      : null;

  const ciRunUrl =
    typeof body.ciRunUrl === "string" && body.ciRunUrl.startsWith("https://")
      ? body.ciRunUrl
      : null;

  // ── Supabase config ────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }

  const stages: StageResult[] = [];
  let createdPropertyId: string | null = null;

  // ── Stage 1: Login ─────────────────────────────────────────────────────────
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: smokeUserEmail,
    password: smokeUserPassword,
  });

  if (authError || !authData.session) {
    stages.push({
      stage: "login",
      status: "fail",
      message: `Authentication failed: ${authError?.message ?? "no session returned"}`,
    });
    return failResponse("login", stages, gitSha, ciRunUrl, null);
  }

  stages.push({ stage: "login", status: "pass", message: "Smoke test user authenticated." });

  // ── User-scoped client — enforces RLS via the smoke user's JWT ─────────────
  const accessToken = authData.session.access_token;
  const userId = authData.session.user.id;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: "Bearer " + accessToken },
    },
  });

  // Resolve org_id from user_profiles (same pattern as getRepositoryContext)
  const { data: profileData, error: profileError } = await userClient
    .from("user_profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profileData?.org_id) {
    stages.push({
      stage: "login",
      status: "fail",
      message: `Smoke user profile missing or inaccessible: ${profileError?.message ?? "no profile row"}. Ensure the smoke account has a user_profiles row with org_id set.`,
    });
    return failResponse("login", stages, gitSha, ciRunUrl, null);
  }

  const orgId = profileData.org_id as string;

  // ── Stage 2: Create property (tests INSERT RLS) ────────────────────────────
  const smokeTag = `__smoke_${Date.now()}__`;

  const { data: createData, error: createError } = await userClient
    .from("properties")
    .insert({
      org_id: orgId,
      name: smokeTag,
      address: "1 Deploy Gate Lane",
      city: "CI",
      type: "Residential",
      status: "Active",
      primary_system: "smoke-test",
      open_jobs: 0,
      last_visit: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (createError || !createData) {
    stages.push({
      stage: "create_property",
      status: "fail",
      message: `Property creation failed: ${createError?.message ?? "no data returned"}`,
    });
    return failResponse("create_property", stages, gitSha, ciRunUrl, null);
  }

  createdPropertyId = createData.id as string;
  stages.push({
    stage: "create_property",
    status: "pass",
    message: `Test property created (id: ${createdPropertyId}).`,
  });

  // ── Stage 3: Delete property (tests DELETE RLS) ────────────────────────────
  const { error: deleteError, count: deleteCount } = await userClient
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", createdPropertyId)
    .eq("org_id", orgId);

  if (deleteError || !deleteCount) {
    stages.push({
      stage: "delete_property",
      status: "fail",
      message: `Property deletion failed: ${deleteError?.message ?? "0 rows deleted (RLS may have blocked the delete)"}`,
    });
    // Report the orphan ID so operators can clean it up manually.
    return failResponse("delete_property", stages, gitSha, ciRunUrl, createdPropertyId);
  }

  stages.push({
    stage: "delete_property",
    status: "pass",
    message: "Test property cleaned up successfully.",
  });

  // ── All stages passed ──────────────────────────────────────────────────────
  return NextResponse.json<SmokeTestResponse>({
    status: "pass",
    failedStage: null,
    stages,
    gitSha,
    ciRunUrl,
    orphanPropertyId: null,
    nextAction: null,
  });
}
