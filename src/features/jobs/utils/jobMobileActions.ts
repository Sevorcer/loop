import { joinAddressParts } from "@/lib/address";

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
  const query = joinAddressParts([location]);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export interface DirectionsOption {
  label: string;
  href: string;
}

/**
 * Directions choices for the My Jobs card: tapping the directions button
 * offers the tech's own maps app instead of forcing Google Maps. Each URL
 * opens turn-by-turn navigation to the job location.
 */
export function buildDirectionsOptions(location: string): DirectionsOption[] | null {
  const query = joinAddressParts([location]);
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return [
    { label: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&destination=${encoded}` },
    { label: "Apple Maps", href: `https://maps.apple.com/?daddr=${encoded}` },
    { label: "Waze", href: `https://waze.com/ul?q=${encoded}&navigate=yes` },
  ];
}

/**
 * F14: maps query for a customer address built from its street/city/ZIP parts.
 */
export function buildCustomerDirectionsUrl(
  street?: string | null,
  city?: string | null,
  zip?: string | null,
): string | null {
  const query = joinAddressParts([street, city, zip]);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
