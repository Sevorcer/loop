import {
  CloudSun,
  Gauge,
  Truck,
  Users,
  UserCheck,
  ClipboardList,
} from "lucide-react";

import type { MorningDashboardMetrics } from "../types/dailyPlan";
import { getReadinessStatus } from "../utils/planUtils";

interface MetricProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  detail?: string;
}

function MetricPill({ label, value, icon, detail }: MetricProps) {
  return (
    <div className="flex min-h-32 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06]">
          {icon}
        </div>
      </div>

      <div>{value}</div>

      {detail ? <p className="text-xs leading-5 text-slate-500">{detail}</p> : null}
    </div>
  );
}

interface ReadinessSummaryProps {
  metrics: MorningDashboardMetrics;
}

export function ReadinessSummary({ metrics }: ReadinessSummaryProps) {
  const readinessStatus = getReadinessStatus(metrics.readinessScore);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <MetricPill
        label="Readiness"
        value={
          <div>
            <p className="text-3xl font-bold tracking-tight text-white">
              {metrics.readinessScore}
              <span className="text-base font-medium text-slate-500">/100</span>
            </p>
            <p className={["mt-1 text-sm font-semibold", readinessStatus.color].join(" ")}>
              {readinessStatus.label}
            </p>
          </div>
        }
        icon={<Gauge className="h-4 w-4 text-blue-300" />}
        detail={`${metrics.readyJobs} jobs ready · ${metrics.attentionJobs} need attention`}
      />

      <MetricPill
        label="Weather"
        value={
          <div>
            <p className="text-xl font-semibold text-white">{metrics.weatherLabel}</p>
            <p className="mt-1 text-sm text-slate-400">
              {metrics.temperatureLow}°–{metrics.temperatureHigh}°
            </p>
          </div>
        }
        icon={<CloudSun className="h-4 w-4 text-yellow-300" />}
        detail={metrics.weatherDetail}
      />

      <MetricPill
        label="Crews"
        value={<p className="text-3xl font-bold tracking-tight text-white">{metrics.activeCrews}</p>}
        icon={<Users className="h-4 w-4 text-green-300" />}
        detail={`${metrics.totalCrews} total crews on the roster`}
      />

      <MetricPill
        label="Jobs Scheduled"
        value={<p className="text-3xl font-bold tracking-tight text-white">{metrics.jobsScheduled}</p>}
        icon={<ClipboardList className="h-4 w-4 text-blue-300" />}
        detail="Planned work on the board today"
      />

      <MetricPill
        label="Installers"
        value={<p className="text-3xl font-bold tracking-tight text-white">{metrics.availableInstallers}</p>}
        icon={<UserCheck className="h-4 w-4 text-emerald-300" />}
        detail="Available field staff before dispatch"
      />

      <MetricPill
        label="Trucks in Service"
        value={<p className="text-3xl font-bold tracking-tight text-white">{metrics.trucksInService}</p>}
        icon={<Truck className="h-4 w-4 text-sky-300" />}
        detail="Dispatch-ready vehicles supporting active crews"
      />
    </div>
  );
}
