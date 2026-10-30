"use client";

import { AlertTriangle, CalendarClock, ClipboardList, Wrench } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import type { Job } from "../types/job";
import { summarizeJobBoard } from "../utils/jobBoardStats";
import { useJobs } from "../state/JobsProvider";

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
          {icon}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function JobsMetrics({ initialJobs = [] }: { initialJobs?: Job[] }) {
  const { jobs, hydrated } = useJobs();
  // The server list is the count until the client store has loaded. A failed
  // client refresh used to replace that list with [] and show Total Jobs 0.
  const source = !hydrated ? initialJobs : jobs.length > 0 ? jobs : initialJobs;
  const stats = summarizeJobBoard(source);
  const totalJobs = stats.total;
  const inProgressJobs = stats.inProgress;
  const scheduledJobs = stats.scheduled;
  const highPriorityJobs = stats.highPriority;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Total Jobs"
        value={totalJobs}
        detail="All open and historical work orders in the board."
        icon={<ClipboardList className="h-5 w-5 text-red-300" />}
      />

      <MetricCard
        title="In Progress"
        value={inProgressJobs}
        detail="Jobs currently being worked by field teams."
        icon={<Wrench className="h-5 w-5 text-blue-300" />}
      />

      <MetricCard
        title="Scheduled"
        value={scheduledJobs}
        detail="Upcoming installs, service calls, and inspections."
        icon={<CalendarClock className="h-5 w-5 text-slate-200" />}
      />

      <MetricCard
        title="High Priority"
        value={highPriorityJobs}
        detail="Jobs needing urgent attention or close monitoring."
        icon={<AlertTriangle className="h-5 w-5 text-red-300" />}
      />
    </div>
  );
}