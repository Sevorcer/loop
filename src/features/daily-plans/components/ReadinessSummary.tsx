import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  UserCheck,
  UserX,
} from "lucide-react";

import type { ReadinessMetrics } from "../utils/planUtils";

interface MetricProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  detail?: string;
}

function MetricPill({ label, value, icon, detail }: MetricProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
          {icon}
        </div>
      </div>

      <p className="text-3xl font-bold tracking-tight text-white">{value}</p>

      {detail ? (
        <p className="text-xs text-slate-500">{detail}</p>
      ) : null}
    </div>
  );
}

interface ReadinessSummaryProps {
  metrics: ReadinessMetrics;
}

export function ReadinessSummary({ metrics }: ReadinessSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricPill
        label="Planned"
        value={metrics.totalPlanned}
        icon={<ClipboardList className="h-4 w-4 text-blue-300" />}
        detail="Jobs scheduled for the day"
      />

      <MetricPill
        label="Assigned"
        value={metrics.assigned}
        icon={<UserCheck className="h-4 w-4 text-green-300" />}
        detail="Covered by field crew"
      />

      <MetricPill
        label="Unassigned"
        value={metrics.unassigned}
        icon={<UserX className="h-4 w-4 text-yellow-300" />}
        detail={metrics.unassigned > 0 ? "Need crew assignment" : "All covered"}
      />

      <MetricPill
        label="At Risk"
        value={metrics.atRisk}
        icon={<AlertTriangle className="h-4 w-4 text-red-300" />}
        detail="On hold, unassigned, or high priority"
      />

      {metrics.completed > 0 || metrics.inProgress > 0 ? (
        <MetricPill
          label="In Progress"
          value={metrics.inProgress}
          icon={<CalendarCheck className="h-4 w-4 text-purple-300" />}
          detail="Currently active in the field"
        />
      ) : null}
    </div>
  );
}
