import {
  LayoutDashboard,
  Users,
  Briefcase,
  Package,
  Brain,
  BarChart3,
  Settings,
  Send,
  MonitorDot,
  CalendarDays,
  CalendarRange,
  Building2,
  HardHat,
  AirVent,
  Truck,
  MessageSquare,
  Receipt,
  Landmark,
  FileCheck,
  ClipboardCheck,
  ListChecks,
} from "lucide-react";

import { getNavItemsForRole, type NavGroup } from "@/features/auth";
import { isAppRole } from "@/features/auth/utils/appRole";
import { ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";

// Navigation groups — workflow-based grouping (PR1 UI/IA hardening).
// Group labels use uppercase to match the established convention.
// Standalone top-level entries, rendered above every group with no group
// heading. My Jobs lives here (Collin, 2026-11-05): its own tab, not part of
// TODAY. Role rules come from NAV_ROUTE_ROLES like every other entry.
export const SHELL_TOP_LEVEL_ITEMS: NavGroup["items"] = [
  { name: "My Jobs", href: ROUTES.MY_JOBS, icon: ListChecks },
];

/**
 * Top-level entries the role may see. Portal and unknown roles get none
 * (unlike the grouped nav, this does not fall back to tech-level links).
 */
export function composeTopLevelNav(
  role: AppRole | string | null | undefined,
  items: NavGroup["items"] = SHELL_TOP_LEVEL_ITEMS,
): NavGroup["items"] {
  if (!isAppRole(role) || role === "portal") return [];
  return getNavItemsForRole(role, [{ label: "", items }])[0]?.items ?? [];
}

export const SHELL_NAV_GROUPS: NavGroup[] = [
  {
    label: "TODAY",
    items: [
      { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
      // "Operations" is the former Command Center (renamed 2026-11-05). The old
      // Operations launcher hub was removed — it only repeated these links.
      { name: "Operations", href: ROUTES.OPERATIONS, icon: MonitorDot },
      { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
      { name: "Calendar", href: ROUTES.CALENDAR, icon: CalendarRange },
    ],
  },
  {
    label: "FIELD",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
      { name: "My van", href: ROUTES.INVENTORY_MY_VAN, icon: Truck },
      { name: "Permits", href: ROUTES.PERMITS_BOARD, icon: FileCheck },
      { name: "Inspections", href: ROUTES.INSPECTIONS_WEEK, icon: ClipboardCheck },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: Users },
      { name: "Contractors", href: ROUTES.CONTRACTORS, icon: HardHat },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: AirVent },
      { name: "Vehicle Alerts", href: ROUTES.VEHICLE_ALERTS, icon: Truck },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: Brain },
      { name: "Inventory", href: ROUTES.INVENTORY, icon: Package },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { name: "Ready to Bill", href: ROUTES.BILLING, icon: Receipt },
      { name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 },
      { name: "GC Overview", href: ROUTES.GC_OVERVIEW, icon: Landmark },
      { name: "Feedback Reports", href: ROUTES.OPS_FEEDBACK, icon: MessageSquare },
    ],
  },
  {
    label: "SETTINGS",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: Settings }],
  },
];

// Role presets are a prioritization layer on top of the baseline sidebar.
// Only roles called out in the post-pilot requirements receive custom ordering;
// every other role keeps the baseline group/item order unless a user override
// exists in local preferences.
const ROLE_NAV_PRESET_ORDER: Partial<Record<AppRole, readonly string[]>> = {
  owner: [ROUTES.DASHBOARD, ROUTES.OPERATIONS, ROUTES.REPORTING, ROUTES.SETTINGS],
  dispatch: [ROUTES.DISPATCH, ROUTES.OPERATIONS, ROUTES.JOBS],
  tech: [ROUTES.DASHBOARD, ROUTES.JOBS, ROUTES.INVENTORY_MY_VAN],
};

export interface ComposeSidebarNavOptions {
  role: AppRole | string | null | undefined;
  groups?: NavGroup[];
  navOverride?: readonly string[] | null | undefined;
}

function buildOrderRank(hrefs: readonly string[]): Map<string, number> {
  return new Map(hrefs.map((href, index) => [href, index]));
}

function rankItem(href: string, rank: Map<string, number>): number {
  return rank.get(href) ?? Number.POSITIVE_INFINITY;
}

function sortItems(items: NavGroup["items"], rank: Map<string, number>) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftRank = rankItem(left.item.href, rank);
      const rightRank = rankItem(right.item.href, rank);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function getPreferredHrefOrder(
  role: ComposeSidebarNavOptions["role"],
  navOverride: ComposeSidebarNavOptions["navOverride"]
): readonly string[] {
  if (navOverride && navOverride.length > 0) {
    return navOverride;
  }

  if (typeof role !== "string") {
    return [];
  }

  return ROLE_NAV_PRESET_ORDER[role as AppRole] ?? [];
}

export function composeSidebarNav({
  role,
  groups = SHELL_NAV_GROUPS,
  navOverride,
}: ComposeSidebarNavOptions): NavGroup[] {
  const visibleGroups = getNavItemsForRole(role, groups);
  // Fail closed: unrecognized roles see tech-level nav (most restricted),
  // never the full unfiltered sidebar.
  const resolvedGroups = visibleGroups.length === 0
    ? getNavItemsForRole("tech", groups)
    : visibleGroups;
  const preferredOrder = getPreferredHrefOrder(role, navOverride);

  if (preferredOrder.length === 0) {
    return resolvedGroups;
  }

  const rank = buildOrderRank(preferredOrder);

  return resolvedGroups
    .map((group, index) => {
      const items = sortItems(group.items, rank);
      const groupRank = items.reduce(
        (bestRank, item) => Math.min(bestRank, rankItem(item.href, rank)),
        Number.POSITIVE_INFINITY
      );

      return {
        group,
        index,
        items,
        groupRank,
      };
    })
    .sort((left, right) => {
      if (left.groupRank !== right.groupRank) {
        return left.groupRank - right.groupRank;
      }

      return left.index - right.index;
    })
    .map(({ group, items }) => ({
      ...group,
      items,
    }));
}
