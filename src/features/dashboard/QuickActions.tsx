"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Briefcase, Building2, CalendarDays, HardHat } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { useCurrentRole } from "@/features/auth";
import { NAV_ROUTE_ROLES } from "@/features/auth/utils/navPermissions";

const actions = [
  { label: "New Job", href: `${ROUTES.JOBS}/new`, route: ROUTES.JOBS, icon: Briefcase },
  { label: "New Property", href: `${ROUTES.PROPERTIES}/new`, route: ROUTES.PROPERTIES, icon: Building2 },
  { label: "Add Contractor", href: `${ROUTES.CONTRACTORS}/new`, route: ROUTES.CONTRACTORS, icon: HardHat },
  { label: "Daily Plan", href: ROUTES.DAILY_PLANS, route: ROUTES.DAILY_PLANS, icon: CalendarDays },
];

export function QuickActions() {
  const { role } = useCurrentRole();

  const visibleActions = useMemo(() => {
    if (!role) return actions;
    return actions.filter((action) => {
      const allowed = NAV_ROUTE_ROLES[action.route];
      // Routes absent from the map are visible to all internal roles.
      if (!allowed) return true;
      return allowed.includes(role);
    });
  }, [role]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleActions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg border border-default bg-surface px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-surface-elevated hover:border-primary"
          >
            <Icon className="h-4 w-4 text-accent" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
