/** Re-check every 60 s while the tab is visible (plan §5 — no Realtime, no migration). */
export const LIVE_REFRESH_MS = 60_000;

/**
 * Decide whether a refresh is due: only while the page is visible and the
 * data on screen is at least one interval old.
 */
export function shouldRefresh(
  visibility: DocumentVisibilityState | string,
  lastRefreshMs: number,
  nowMs: number,
  intervalMs = LIVE_REFRESH_MS,
): boolean {
  return visibility === "visible" && nowMs - lastRefreshMs >= intervalMs;
}
