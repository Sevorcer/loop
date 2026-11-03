// ---------------------------------------------------------------------------
// Callback definitions — the single source of truth for what a "callback" is
// across every surface (Dashboard, Command Center, Jobs list).
//
// A callback is a job whose TYPE is "Callback". It is NEVER inferred from the
// job's title or notes text — matching "callback" in free text produced
// false positives and disagreeing counts between screens.
//
// Two canonical definitions:
//   • Open callbacks  — type === "Callback" AND status NOT in
//                        (Completed, Cancelled). What needs attention now.
//   • All callbacks    — type === "Callback". Every callback ever logged.
//
// Server-side counts use CALLBACK_TYPE_QUERY_VARIANTS +
// OPEN_JOB_STATUS_EXCLUSION_FILTER with an exact `count` query. Client-side
// filtering uses the predicates below. Both agree by construction.
// ---------------------------------------------------------------------------

import { isOpenStatus, OPEN_JOB_STATUS_EXCLUSION_FILTER } from "@/lib/jobs/status";

export { OPEN_JOB_STATUS_EXCLUSION_FILTER };

/** Canonical job type for callbacks. */
export const CALLBACK_TYPE = "Callback" as const;

/**
 * Type values accepted by a PostgREST `.in("type", ...)` filter. The database
 * has historically stored either the canonical "Callback" or a lowercase
 * "callback"; both count as a callback.
 */
export const CALLBACK_TYPE_QUERY_VARIANTS: readonly string[] = ["Callback", "callback"];

/** Minimal shape needed to classify a job as a callback. */
export interface CallbackClassifiable {
  type: string | null | undefined;
  status?: string | null | undefined;
}

/** True when the job's TYPE is Callback (case/whitespace insensitive). */
export function isCallbackType(type: string | null | undefined): boolean {
  return (type ?? "").trim().toLowerCase() === "callback";
}

/** True for any callback, regardless of status ("all callbacks"). */
export function isCallbackJob(job: CallbackClassifiable): boolean {
  return isCallbackType(job.type);
}

/**
 * True for an OPEN callback: type Callback AND status not Completed/Cancelled.
 * This is the "Open callbacks" definition shared by every surface.
 */
export function isOpenCallbackJob(job: CallbackClassifiable): boolean {
  return isCallbackType(job.type) && isOpenStatus(job.status);
}

/**
 * Human-facing labels. Surfaces use these verbatim so the numbers explain
 * themselves ("Open callbacks" vs "Callbacks (all time)").
 */
export const CALLBACK_LABELS = {
  open: "Open callbacks",
  all: "Callbacks (all time)",
} as const;
