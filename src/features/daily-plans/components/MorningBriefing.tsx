import {
  CalendarDays,
  Users,
  ClipboardList,
  UserCheck,
  UserX,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

import { formatPlanDate, getDayLabel } from "../utils/planUtils";

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: "warning" | "danger" | "success";
}

function KpiTile({ icon, label, value, highlight }: KpiTileProps) {
  const valueClass =
    highlight === "danger"
      ? "text-red-300"
      : highlight === "warning"
        ? "text-yellow-300"
        : highlight === "success"
          ? "text-green-300"
          : "text-white";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06]">
          {icon}
        </div>
      </div>
      <p className={["text-2xl font-bold tabular-nums", valueClass].join(" ")}>
        {value}
      </p>
    </div>
  );
}

interface MorningBriefingProps {
  date: string;
  totalToday: number;
  assigned: number;
  unassigned: number;
  atRisk: number;
  waitingPermit: number;
  activeCrews: number;
}

export function MorningBriefing({
  date,
  totalToday,
  assigned,
  unassigned,
  atRisk,
  waitingPermit,
  activeCrews,
}: MorningBriefingProps) {
  const dayLabel = getDayLabel(date);

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Morning Briefing
          </p>
          <p className="text-sm font-medium text-slate-300">
            {dayLabel === "Today" ? `Today · ${formatPlanDate(date)}` : formatPlanDate(date)}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          icon={<ClipboardList className="h-3.5 w-3.5 text-blue-300" />}
          label="Total"
          value={totalToday}
        />
        <KpiTile
          icon={<UserCheck className="h-3.5 w-3.5 text-green-300" />}
          label="Assigned"
          value={assigned}
          highlight={assigned === totalToday && totalToday > 0 ? "success" : undefined}
        />
        <KpiTile
          icon={<UserX className="h-3.5 w-3.5 text-yellow-300" />}
          label="Unassigned"
          value={unassigned}
          highlight={unassigned > 0 ? "warning" : undefined}
        />
        <KpiTile
          icon={<AlertTriangle className="h-3.5 w-3.5 text-red-300" />}
          label="At-Risk / Late"
          value={atRisk}
          highlight={atRisk > 0 ? "danger" : undefined}
        />
        <KpiTile
          icon={<ShieldCheck className="h-3.5 w-3.5 text-violet-300" />}
          label="Permit Waiting"
          value={waitingPermit}
          highlight={waitingPermit > 0 ? "warning" : undefined}
        />
        <KpiTile
          icon={<Users className="h-3.5 w-3.5 text-sky-300" />}
          label="Active Crews"
          value={activeCrews}
        />
      </div>
    </div>
  );
}
