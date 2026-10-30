import { Activity, CalendarDays, FileText, RefreshCcw, Users } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { DashboardSummary } from "@/repositories/dashboard";
import { getCurrentOperator } from "@/services/currentOperator";

import { buildOperationalHealth } from "./data/operationalHealth";

const SIGNAL_ICONS = {
  "Today's Jobs": CalendarDays,
  "Active Crews": Users,
  Callbacks: RefreshCcw,
  "Open Estimates": FileText,
  "Dispatch Status": Activity,
} as const;

interface DashboardHeaderProps {
  summary: DashboardSummary;
}

export async function DashboardHeader({ summary }: DashboardHeaderProps) {
  const operator = await getCurrentOperator();
  if (operator.appRole === "tech") redirect(ROUTES.JOBS);
  const userName = operator.name;

  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles",
    }).format(new Date()),
  );

  const greeting =
    currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";

  const health = buildOperationalHealth(summary);
  const statusClass = health.status === "Needs attention" ? "status-warning" : "status-success";

  return (
    <div className="space-y-5">
      <PageHeader
        title={health.title}
        description={health.context}
        actions={
          <span
            className={`${statusClass} w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest`}
          >
            {health.status}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {health.signals.map((signal) => {
          const Icon = SIGNAL_ICONS[signal.label as keyof typeof SIGNAL_ICONS] ?? Activity;
          return (
            <div key={signal.label} className="rounded-lg border border-default bg-surface-elevated p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-accent" />
                <p className="text-muted text-xs font-semibold uppercase tracking-widest">{signal.label}</p>
              </div>
              <p className="text-primary mt-2 text-sm font-semibold sm:text-base">{signal.value}</p>
            </div>
          );
        })}
      </div>

      <p className="text-muted text-xs">
        {`${greeting}, ${userName}`}
      </p>
    </div>
  );
}
