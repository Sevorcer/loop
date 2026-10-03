"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Paperclip,
  Pencil,
  PlusCircle,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Job } from "@/features/jobs/types/job";
import type { JobActivity, JobActivityType } from "@/features/jobs/types/jobActivity";

const ACTIVITY_ICONS: Record<JobActivityType, LucideIcon> = {
  created: PlusCircle,
  edited: Pencil,
  scheduled: CalendarClock,
  assigned: Users,
  contractor: Users,
  status: CheckCircle2,
  note: Paperclip,
  qa: ClipboardCheck,
  file: FileText,
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMinutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  const diffYears = Math.round(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

interface ActivityItem {
  activity: JobActivity;
  job?: Job;
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data = (await res.json()) as { jobs?: Job[]; activity?: JobActivity[] };
        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const activity = Array.isArray(data.activity) ? data.activity : [];
        const jobsById = new Map(jobs.map((job) => [job.id, job]));
        const recent = [...activity]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 4)
          .map((entry) => ({ activity: entry, job: jobsById.get(entry.jobId) }));
        if (!cancelled) setItems(recent);
      } catch {
        if (!cancelled) setItems([]);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="hover-lift">
      <CardHeader>
        <div className="space-y-3">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>See the latest updates across your operations.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items === null ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Loading recent activity…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No recent activity yet.
          </p>
        ) : (
          items.map(({ activity, job }) => {
            const Icon = ACTIVITY_ICONS[activity.type];
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 rounded-lg border p-4 atlas-transition atlas-hover-border-primary"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-surface-elevated)",
                }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-primary)",
                  }}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {activity.title}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {job ? `#${job.jobNumber} · ${job.customerName}` : activity.description}
                  </p>
                  {job ? (
                    <p className="mt-1 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                      {job.status}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
