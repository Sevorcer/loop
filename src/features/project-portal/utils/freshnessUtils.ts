import type { FreshnessLevel, FreshnessState } from "../types/portalTypes";

// ─── Freshness Thresholds (minutes) ──────────────────────────────────────────

const STALE_THRESHOLD_MINUTES = 5;
const ELEVATED_STALE_THRESHOLD_MINUTES = 15;

// ─── Freshness Calculation ────────────────────────────────────────────────────

/**
 * Compute the freshness state for a given lastSyncedAt timestamp.
 *
 * Thresholds per event-contract-spec.md:
 * - < 5 min  → fresh
 * - 5–15 min → stale (show warning banner)
 * - > 15 min → elevated_stale (show elevated banner with support link)
 * - null/unavailable → unavailable
 */
export function computeFreshness(lastSyncedAt: string | null): FreshnessState {
  if (!lastSyncedAt) {
    return {
      level: "unavailable",
      lastSyncedAt: "",
      minutesAgo: Infinity,
    };
  }

  const syncedDate = new Date(lastSyncedAt);
  const now = new Date();
  const diffMs = now.getTime() - syncedDate.getTime();
  const minutesAgo = Math.floor(diffMs / (1000 * 60));

  let level: FreshnessLevel;
  if (minutesAgo < STALE_THRESHOLD_MINUTES) {
    level = "fresh";
  } else if (minutesAgo < ELEVATED_STALE_THRESHOLD_MINUTES) {
    level = "stale";
  } else {
    level = "elevated_stale";
  }

  return { level, lastSyncedAt, minutesAgo };
}

// ─── Freshness Display ────────────────────────────────────────────────────────

/**
 * Format the "Last synchronized X minutes ago" display string.
 */
export function formatLastSynced(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "Unknown";

  const syncedDate = new Date(lastSyncedAt);
  const now = new Date();
  const diffMs = now.getTime() - syncedDate.getTime();
  const minutesAgo = Math.floor(diffMs / (1000 * 60));

  if (minutesAgo < 1) return "Just now";
  if (minutesAgo === 1) return "1 minute ago";
  if (minutesAgo < 60) return `${minutesAgo} minutes ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo === 1) return "1 hour ago";
  return `${hoursAgo} hours ago`;
}

/**
 * Get stale banner copy based on freshness level.
 */
export function getStaleBannerCopy(freshness: FreshnessState): {
  heading: string;
  body: string;
  showSupportLink: boolean;
} {
  const syncText = formatLastSynced(freshness.lastSyncedAt);

  switch (freshness.level) {
    case "stale":
      return {
        heading: "Information may be outdated.",
        body: `Last synchronized ${syncText}. We're working to refresh this. You can continue browsing.`,
        showSupportLink: false,
      };
    case "elevated_stale":
      return {
        heading: "Information may be outdated.",
        body: `Last synchronized ${syncText}. If this persists, please contact support.`,
        showSupportLink: true,
      };
    case "unavailable":
      return {
        heading: "LOOP is temporarily unavailable.",
        body: "We're working on it. Please try again in a few minutes.",
        showSupportLink: true,
      };
    default:
      return { heading: "", body: "", showSupportLink: false };
  }
}
