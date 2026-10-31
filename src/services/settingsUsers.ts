import "server-only";

/**
 * settingsUsers — service layer for the Settings > Users management feature.
 *
 * All Supabase Admin calls are server-only. Routes calling these functions
 * must run in Route Handler or Server Action context.
 *
 * The org-scope is resolved from the requesting user's user_profiles row
 * so that only org members are visible.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAppRole } from "@/features/auth/utils/appRole";
import type { AppRole } from "@/services/authorization";
import {
  refusalForOwnerInvite,
  refusalForProfileRoleChange,
} from "@/services/profileRoleGuard";
import type {
  OrgUser,
  InviteUserPayload,
  UpdateUserPayload,
} from "@/features/settings/types";

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
  status?: number;
}

interface ProfileRow {
  org_id?: string | null;
  app_role?: string | null;
}

interface ProfileWriteResult {
  error: SupabaseErrorLike | null;
}

interface ProfileReadResult {
  data: ProfileRow | null;
  error: SupabaseErrorLike | null;
}

/**
 * The admin client is created without a generated Database type, so the
 * table calls are checked against this narrow shape instead.
 */
interface ProfileAdmin {
  from(table: "user_profiles"): {
    upsert(values: Record<string, unknown>): PromiseLike<ProfileWriteResult>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<ProfileWriteResult>;
    };
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<ProfileReadResult>;
      };
    };
  };
}

function profileAdmin(): ProfileAdmin {
  return createSupabaseAdminClient() as unknown as ProfileAdmin;
}

function toSupabaseServiceError(
  error: SupabaseErrorLike | null | undefined,
  fallbackMessage: string,
): Error & {
  code: string | null;
  details: unknown;
  hint: unknown;
  status: number;
} {
  return Object.assign(new Error(error?.message ?? fallbackMessage), {
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    status: error?.status ?? 500,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Auth admin lookups must not hold the team page open. */
const AUTH_LOOKUP_BUDGET_MS = 4_000;

interface ListedAuthUser {
  id: string;
  email?: string | null;
  banned_until?: string | null;
  last_sign_in_at?: string | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Email and ban state live on auth.users. Listing the whole project with no
 * deadline can stall the Users page, so this stops at the budget and returns
 * whatever it found. Missing auth rows still leave the profile on the page.
 */
async function loadAuthUsersForProfiles(profileIds: string[]): Promise<Map<string, ListedAuthUser>> {
  const wanted = new Set(profileIds);
  const found = new Map<string, ListedAuthUser>();
  if (wanted.size === 0) return found;

  const deadline = Date.now() + AUTH_LOOKUP_BUDGET_MS;
  try {
    const admin = createSupabaseAdminClient();
    for (let page = 1; page <= 20 && found.size < wanted.size; page += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 250) break;
      const pageResult = await withTimeout(
        admin.auth.admin.listUsers({ page, perPage: 200 }),
        remaining,
      );
      const users = pageResult?.data?.users as ListedAuthUser[] | undefined;
      if (!pageResult || pageResult.error || !users || users.length === 0) break;
      for (const user of users) {
        if (wanted.has(user.id)) found.set(user.id, user);
      }
      if (users.length < 200) break;
    }
  } catch {
    return found;
  }

  return found;
}

/** Resolve the org_id of the calling user (server context). */
async function resolveCallerOrgId(userId: string): Promise<string | null> {
  const caller = await readCallerAuthority(userId);
  return caller.orgId;
}

/**
 * Role and company from the caller's own profile row. This is read with
 * their login, which cannot change app_role. Sign-in metadata is ignored.
 */
async function readCallerAuthority(userId: string): Promise<{
  orgId: string | null;
  role: AppRole | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("org_id, app_role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { org_id?: string | null; app_role?: string | null } | null;
  return {
    orgId: row?.org_id ?? null,
    role: isAppRole(row?.app_role) ? row.app_role : null,
  };
}

function assertCanManageStaff(role: AppRole | null): void {
  if (role !== "owner" && role !== "manager") {
    throw refused("Only an owner or manager can manage the team.");
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all users belonging to the same org as the calling user.
 * Merges user_profiles (role, full_name) with auth.users (email, last_sign_in_at, banned).
 */
export async function listOrgUsers(callerUserId: string): Promise<OrgUser[]> {
  const orgId = await resolveCallerOrgId(callerUserId);
  if (!orgId) return [];

  const supabase = await createSupabaseServerClient();
  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, app_role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error || !profiles) return [];

  // Email and last sign-in come from auth.users. A slow or unreachable admin
  // API must not leave the page on "Loading team members…".
  const authMap = await loadAuthUsersForProfiles(profiles.map((profile) => profile.id));

  return profiles.map((profile): OrgUser => {
    const authUser = authMap.get(profile.id);
    const banned =
      authUser?.banned_until != null &&
      new Date(authUser.banned_until) > new Date();

    return {
      id: profile.id,
      email: authUser?.email ?? "",
      fullName: profile.full_name ?? null,
      role: (profile.app_role as AppRole) ?? "office",
      status: banned ? "inactive" : "active",
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      createdAt: profile.created_at,
    };
  });
}

/**
 * Invite a new user to the org via email.
 * Sends a Supabase magic-link invite and pre-creates a user_profiles row.
 */
export async function inviteOrgUser(
  callerUserId: string,
  payload: InviteUserPayload
): Promise<OrgUser> {
  const caller = await readCallerAuthority(callerUserId);
  assertCanManageStaff(caller.role);
  const inviteRefusal = refusalForOwnerInvite({
    callerRole: caller.role,
    appRole: payload.appRole,
  });
  if (inviteRefusal) {
    throw refused(inviteRefusal);
  }

  const orgId = caller.orgId;
  if (!orgId) {
    throw new Error("Caller has no organization.");
  }

  const admin = createSupabaseAdminClient();

  // Send invite email
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    payload.email,
    {
      data: { app_role: payload.appRole, full_name: payload.fullName },
    }
  );

  if (inviteError || !inviteData?.user) {
    throw toSupabaseServiceError(inviteError, "Failed to send invite.");
  }

  const userId = inviteData.user.id;

  // The service role writes the profile. A signed-in person cannot insert
  // their own row or pick a role. The company always comes from the caller.
  const now = new Date().toISOString();
  const { error: profileError } = await profileAdmin().from("user_profiles").upsert({
    id: userId,
    org_id: orgId,
    full_name: payload.fullName,
    app_role: payload.appRole,
    created_at: now,
    updated_at: now,
  });

  if (profileError) {
    throw toSupabaseServiceError(profileError, "Failed to create the user profile.");
  }

  return {
    id: userId,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.appRole,
    status: "active",
    lastSignInAt: null,
    createdAt: now,
  };
}

function refused(message: string, status = 403): Error {
  return Object.assign(new Error(message), { status, code: "FORBIDDEN" });
}

/**
 * Update a user's name and, for someone else, their role.
 * A role change uses the service role because a login cannot write app_role.
 * The company check happens here so that bypass cannot cross companies.
 */
export async function updateOrgUser(
  callerUserId: string,
  userId: string,
  payload: UpdateUserPayload
): Promise<void> {
  const caller = await readCallerAuthority(callerUserId);
  assertCanManageStaff(caller.role);
  const callerOrgId = caller.orgId;
  const admin = createSupabaseAdminClient();
  const profiles = profileAdmin();
  const { data: target, error: targetError } = await profiles
    .from("user_profiles")
    .select("org_id, app_role")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) throw new Error(targetError.message);

  const row = target;
  const refusal = refusalForProfileRoleChange({
    callerId: callerUserId,
    targetId: userId,
    callerRole: caller.role,
    sameCompany: Boolean(callerOrgId) && row?.org_id === callerOrgId,
    currentRole: row?.app_role ?? null,
    nextRole: payload.role,
  });
  if (refusal) throw refused(refusal);

  const roleIsChanging = payload.role !== undefined && payload.role !== row?.app_role;
  const editingSomeoneElse = userId !== callerUserId;
  const updatedAt = new Date().toISOString();

  if (roleIsChanging || (payload.fullName !== undefined && editingSomeoneElse)) {
    const updates: Record<string, unknown> = {
      updated_at: updatedAt,
    };
    if (payload.fullName !== undefined) updates.full_name = payload.fullName;
    if (roleIsChanging) updates.app_role = payload.role;

    const { error } = await profiles.from("user_profiles").update(updates).eq("id", userId);
    if (error) throw new Error(error.message);

    if (roleIsChanging) {
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: { app_role: payload.role },
      });
    }
    return;
  }

  if (payload.fullName !== undefined) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ full_name: payload.fullName, updated_at: updatedAt })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }
}

/**
 * Activate or deactivate a user account.
 * Uses Supabase's ban_duration field — deactivated users are banned until 2099.
 */

/** Duration string used to effectively permanently ban a user. ~100 years. */
const PERMANENT_BAN_DURATION = "876000h" as const;

export async function setOrgUserStatus(
  userId: string,
  status: "active" | "inactive"
): Promise<void> {
  const admin = createSupabaseAdminClient();

  if (status === "inactive") {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: PERMANENT_BAN_DURATION,
    });
  } else {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });
  }
}

/**
 * Trigger a password reset email for a user.
 */
export async function resetOrgUserPassword(email: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Use generateLink to create a recovery link; triggers email via Supabase
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) throw new Error(error.message);
}
