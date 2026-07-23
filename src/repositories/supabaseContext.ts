import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DEVELOPMENT_ORG_ID = "00000000-0000-4000-8000-000000000001";

export interface RepositoryContext {
  orgId: string;
  supabase: SupabaseClient;
  mode: "session" | "development";
}

export interface SessionRepositoryContextInput {
  userId: string;
}

type UserProfileLookupFailureReason = "profile_row_missing_or_rls_hidden" | "profile_org_id_missing";

interface UserProfileLookupErrorDetails {
  table: "user_profiles";
  filters: {
    id: string;
  };
  retrieval: "maybeSingle";
  lookup: "user_profiles.id -> org_id";
  userId: string;
  reason: UserProfileLookupFailureReason;
}

function buildUserProfileNotFoundError(
  userId: string,
  reason: UserProfileLookupFailureReason,
): Error & {
  code: "USER_PROFILE_NOT_FOUND";
  details: UserProfileLookupErrorDetails;
} {
  return Object.assign(new Error("USER_PROFILE_NOT_FOUND"), {
    code: "USER_PROFILE_NOT_FOUND" as const,
    details: {
      table: "user_profiles" as const,
      filters: { id: userId },
      retrieval: "maybeSingle" as const,
      lookup: "user_profiles.id -> org_id" as const,
      userId,
      reason,
    },
  });
}

export async function getRepositoryContext(
  input?: SessionRepositoryContextInput,
): Promise<RepositoryContext> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const supabase = await createSupabaseServerClient();

  // If route already authenticated user, trust that identity and skip a second auth.getUser() lookup.
  let userId: string | null = input?.userId ?? null;

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (userId) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("id,org_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(error.message), {
        status: (error as { status?: number }).status ?? null,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: unknown }).details ?? null,
        hint: (error as { hint?: unknown }).hint ?? null,
      });
    }

    if (!profile) {
      throw buildUserProfileNotFoundError(userId, "profile_row_missing_or_rls_hidden");
    }

    if (!profile.org_id) {
      throw buildUserProfileNotFoundError(userId, "profile_org_id_missing");
    }

    return {
      orgId: profile.org_id,
      supabase,
      mode: "session",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      return {
        orgId: process.env.LOOP_DEFAULT_ORG_ID ?? DEFAULT_DEVELOPMENT_ORG_ID,
        supabase: adminClient,
        mode: "development",
      };
    }
  }

  throw new Error("SUPABASE_SESSION_REQUIRED");
}