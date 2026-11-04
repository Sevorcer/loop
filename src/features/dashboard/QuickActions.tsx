"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Briefcase, Building2, CalendarDays, HardHat } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { useCurrentRole } from "@/features/auth";
import { NAV_ROUTE_ROLES } from "@/features/auth/utils/navPermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <Card className="hover-lift">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Start your most common workflows with one click.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border p-4 text-center atlas-transition atlas-hover-surface atlas-hover-border-primary"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-surface-elevated)",
                }}
              >
                <Icon size={24} style={{ color: "var(--color-primary)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
