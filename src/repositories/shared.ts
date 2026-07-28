// ---------------------------------------------------------------------------
// Domain constants shared across Supabase repositories
// ---------------------------------------------------------------------------

import { OPEN_JOB_STATUS_EXCLUSION_FILTER } from "@/lib/jobs/status";

export { OPEN_JOB_STATUS_EXCLUSION_FILTER };
export const UNLINKED_CUSTOMER_LABEL = "Unlinked Customer";

// ---------------------------------------------------------------------------
// #61 — Shared repository utilities
//
// Canonical location for error-wrapping helpers consumed by all Supabase
// repository implementations.  All pagination / filtering / sorting helpers
// live in src/lib/repositories/contracts.ts and are re-exported here so
// that repository files can import from a single well-known place.
// ---------------------------------------------------------------------------

export {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  applySort,
  isFilterMatch,
  normalizePagination,
  paginateItems,
} from "@/lib/repositories/contracts";

export type {
  CrudRepository,
  PaginatedResult,
  PaginationParams,
  RepositoryError,
  RepositoryFilters,
  RepositoryQuery,
  RepositoryResult,
  RepositorySort,
  SortDirection,
} from "@/lib/repositories/contracts";

// ---------------------------------------------------------------------------
// Supabase error → RepositoryResult mapper
//
// Usage:
//   const result = await wrapRepositoryError(async () => {
//     const { data, error } = await supabase.from("...").select("...");
//     if (error) throw error;
//     return data;
//   });
// ---------------------------------------------------------------------------

import type { RepositoryResult } from "@/lib/repositories/contracts";

/**
 * Runs `fn` and wraps any thrown error into a typed `RepositoryResult`.
 * Supabase client errors, configuration errors, and unknown errors are all
 * mapped to a consistent `{ ok: false, error: { code, message } }` shape.
 */
export async function wrapRepositoryError<T>(
  fn: () => Promise<T>
): Promise<RepositoryResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = mapErrorCode(message);
    return { ok: false, error: { code, message } };
  }
}

function mapErrorCode(message: string): string {
  if (message === "SUPABASE_NOT_CONFIGURED") return "UNAVAILABLE";
  if (message === "SUPABASE_SESSION_REQUIRED") return "UNAUTHORIZED";
  if (message === "USER_PROFILE_NOT_FOUND") return "UNAUTHORIZED";
  if (message.toLowerCase().includes("not found")) return "NOT_FOUND";
  if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
    return "CONFLICT";
  }
  if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")) {
    return "FORBIDDEN";
  }
  return "INTERNAL";
}
