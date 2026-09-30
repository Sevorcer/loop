import type { JobStatus } from "../types/job";
import { getValidNextStatuses } from "./jobWorkspace";

export interface PrimaryAdvance {
  status: JobStatus;
  label: string;
}

/**
 * F14: the one action a tech reaches for most on a phone. Pick the forward
 * lifecycle move from the current status:
 * - Scheduled → Start Job (In Progress)
 * - In Progress → Mark Complete (Completed)
 * - On Hold → Resume Job (In Progress)
 * Terminal statuses (Completed, Cancelled) have no advance.
 */
export function getPrimaryAdvance(current: JobStatus): PrimaryAdvance | null {
  const valid = getValidNextStatuses(current);

  if (valid.includes("In Progress")) {
    return {
      status: "In Progress",
      label: current === "Scheduled" ? "Start Job" : "Resume Job",
    };
  }

  if (valid.includes("Completed")) {
    return { status: "Completed", label: "Mark Complete" };
  }

  return null;
}

/**
 * F14: universal Google Maps search URL for the job's location string,
 * so a tech can jump to turn-by-turn directions from the sticky action bar.
 */
export function buildDirectionsUrl(location: string): string | null {
  const query = location.trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * F14: maps query for a customer address built from its street/city/ZIP parts.
 */
export function buildCustomerDirectionsUrl(
  street?: string | null,
  city?: string | null,
  zip?: string | null,
): string | null {
  const query = [street, city, zip]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
