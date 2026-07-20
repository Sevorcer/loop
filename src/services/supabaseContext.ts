import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEV_ORG_ID = process.env.LOOP_DEV_ORG_ID ?? null;

export function getSupabaseAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseAdminClient() as any;
}

export async function resolveOrgId() {
  if (DEV_ORG_ID) {
    return DEV_ORG_ID;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();

  const organization = data as { id: string } | null;

  if (error || !organization?.id) {
    throw new Error(error?.message ?? "Unable to resolve organization id.");
  }

  return organization.id;
}
