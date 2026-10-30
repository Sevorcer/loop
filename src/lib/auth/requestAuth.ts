import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RequestAuth {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * One verified user per request. Route guards call Supabase Auth once;
 * later repository reads reuse that client instead of calling getUser again.
 */
const requestAuthSlot = cache(() => ({
  current: null as RequestAuth | null,
}));

export function rememberRequestAuth(auth: RequestAuth) {
  if (!auth.userId) return;
  requestAuthSlot().current = auth;
}

export function readRequestAuth(): RequestAuth | null {
  return requestAuthSlot().current;
}
