/**
 * Operations navigation configuration — Sprint 30A PR1.
 *
 * Defines the operational phases shown in OperationsNavBar and the
 * OperationsHomeScreen. Each phase maps to an existing route.
 */

import { ROUTES } from "@/lib/routes";

export interface OperationsNavItem {
  name: string;
  /** Short label for compact displays (e.g. mobile tab bar). */
  shortName: string;
  href: string;
  description: string;
}

export const OPERATIONS_NAV_ITEMS: readonly OperationsNavItem[] = [
  {
    name: "Operations Home",
    shortName: "Home",
    href: ROUTES.OPERATIONS,
    description: "Operational overview — what kind of day is this?",
  },
  {
    name: "Command Center",
    shortName: "Command",
    href: ROUTES.COMMAND_CENTER,
    description: "Always-on install manager view — risk, crew load, and priorities.",
  },
  {
    name: "Morning Operations",
    shortName: "Morning",
    href: ROUTES.DAILY_PLANS,
    description: "Assign crews, confirm readiness, and prepare the field.",
  },
  {
    name: "Live Operations",
    shortName: "Live",
    href: ROUTES.LIVE_OPERATIONS,
    description: "Track active work, crews in the field, and exceptions.",
  },
  {
    name: "Dispatch",
    shortName: "Dispatch",
    href: ROUTES.DISPATCH,
    description: "Commit jobs into motion and coordinate the crew schedule.",
  },
] as const;
