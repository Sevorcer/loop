import "server-only";

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  return createRouteHandlerClient({ cookies });
}