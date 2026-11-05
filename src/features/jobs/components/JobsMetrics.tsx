"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ClipboardList, Wrench } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import type { Job } from "../types/job";
import { summarizeJobBoard, type JobBoardStats } from "../utils/jobBoardStats";

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
  const { role } = useCurrentRole();
  // Exact counts from the database (GET /api/jobs?view=stats). This used to
  // download every job into the browser and count them there — 15 sequential
  // page reads that also stopped at 3,000 jobs. Until the counts arrive (or if
  // the request fails) the server-provided list, if any, is the fallback, so
  // a failed refresh never shows Total Jobs 0 over a full board.
  // Priority card removed (Option C); jobs.priority stays in the database.
  const [serverStats, setServerStats] = useState<JobBoardStats | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    void requestJson<{ stats: JobBoardStats }>("/api/jobs?view=stats", {
      role,
      cache: "no-store",
    })
      .then((response) => {
        if (!cancelled && response.stats) setServerStats(response.stats);
      })
      .catch((error) => {
        console.error("[jobs] failed to load job board stats", error);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const stats = serverStats ?? summarizeJobBoard(initialJobs);
  const totalJobs = stats.total;
  const inProgressJobs = stats.inProgress;
  const scheduledJobs = stats.scheduled;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}
