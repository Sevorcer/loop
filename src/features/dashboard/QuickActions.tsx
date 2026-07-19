import Link from "next/link";
import { Briefcase, Building2, CalendarDays, HardHat } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const actions = [
  { label: "New Job", href: `${ROUTES.JOBS}/new`, icon: Briefcase },
  { label: "New Property", href: `${ROUTES.PROPERTIES}/new`, icon: Building2 },
  { label: "Add Contractor", href: `${ROUTES.CONTRACTORS}/new`, icon: HardHat },
  { label: "Daily Plan", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
];

export function QuickActions() {
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
          {actions.map((action) => {
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
