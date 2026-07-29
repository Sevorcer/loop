import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  Cpu,
  Package,
  Brain,
  BarChart3,
  Settings,
  Send,
  MonitorDot,
} from "lucide-react";

import { getNavItemsForRole, type NavGroup } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";

// Navigation groups per Sprint 7 navigation-ux-goals spec.
// Group labels use uppercase to match the spec exactly.
export const SHELL_NAV_GROUPS: NavGroup[] = [
  {
    label: "TODAY",
    items: [
      { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
      { name: "Command Center", href: ROUTES.COMMAND_CENTER, icon: MonitorDot },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: Users },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: Cpu },
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
    items: [{ name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 }],
  },
  {
    label: "SETTINGS",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: Settings }],
  },
];

const ROLE_NAV_PRESET_ORDER: Partial<Record<AppRole, readonly string[]>> = {
  owner: [ROUTES.DASHBOARD, ROUTES.COMMAND_CENTER, ROUTES.REPORTING, ROUTES.SETTINGS],
  dispatch: [ROUTES.DISPATCH, ROUTES.COMMAND_CENTER, ROUTES.JOBS],
  tech: [ROUTES.DASHBOARD, ROUTES.JOBS, ROUTES.PROPERTIES, ROUTES.INSTALLED_SYSTEMS],
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
  const preferredOrder = getPreferredHrefOrder(role, navOverride);

  if (preferredOrder.length === 0) {
    return visibleGroups;
  }

  const rank = buildOrderRank(preferredOrder);

  return visibleGroups
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
