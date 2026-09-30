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
  Radio,
  Building2,
  HardHat,
  AirVent,
  Truck,
  Workflow,
  MessageSquare,
} from "lucide-react";

import { getNavItemsForRole, type NavGroup } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";

// Navigation groups — workflow-based grouping (PR1 UI/IA hardening).
// Group labels use uppercase to match the established convention.
export const SHELL_NAV_GROUPS: NavGroup[] = [
  {
    label: "TODAY",
    items: [
      { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
      { name: "Command Center", href: ROUTES.COMMAND_CENTER, icon: MonitorDot },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
      { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
      { name: "Calendar", href: ROUTES.CALENDAR, icon: CalendarRange },
      { name: "Live Operations", href: ROUTES.LIVE_OPERATIONS, icon: Radio },
      { name: "Operations", href: ROUTES.OPERATIONS, icon: Workflow },
    ],
  },
  {
    label: "FIELD",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
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
      { name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 },
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
  owner: [ROUTES.DASHBOARD, ROUTES.COMMAND_CENTER, ROUTES.REPORTING, ROUTES.SETTINGS],
  dispatch: [ROUTES.DISPATCH, ROUTES.COMMAND_CENTER, ROUTES.JOBS],
  tech: [ROUTES.DASHBOARD, ROUTES.JOBS],
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
  const shouldBypassRoleFilter = role !== "portal" && visibleGroups.length === 0;
  const resolvedGroups = shouldBypassRoleFilter ? groups : visibleGroups;
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
