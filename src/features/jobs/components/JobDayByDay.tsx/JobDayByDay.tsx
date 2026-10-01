"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, FileUp, Loader2, MessageSquareText } from "lucide-react";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import type { JobTask } from "@/repositories/jobTasks";
import type { JobActivity } from "../types/jobActivity";

const DAY_TZ = "America/Los_Angeles";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: DAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFmt = new Intl.DateTimeFormat("en-US", { timeZone: DAY_TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: DAY_TZ, hour: "numeric", minute: "2-digit" });

function dayKey(iso: string): string { return dayKeyFmt.format(new Date(iso)); }
function dayLabel(iso: string): string { return dayLabelFmt.format(new Date(iso)); }

type DayEntry = { id: string; kind: "task" | "file" | "event"; text: string; at: string };
type JobFileLite = { id: string; fileName?: string; createdAt?: string };

export function JobDayByDay({ jobId, activity }: { jobId: string; activity: JobActivity[] }) {
  const { role } = useCurrentRole();
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [files, setFiles] = useState<JobFileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    (async () => {
      try {
        const [t, f] = await Promise.all([
          requestJson<{ tasks: JobTask[] }>(`/api/jobs/${jobId}/tasks`, { role, cache: "no-store" }).catch(() => ({ tasks: [] as JobTask[] })),
          requestJson<{ files: JobFileLite[] }>(`/api/jobs/${jobId}/files`, { role, cache: "no-store" }).catch(() => ({ files: [] as JobFileLite[] })),
        ]);
        if (cancelled) return;
        setTasks(t.tasks ?? []);
        setFiles(f.files ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, role]);

  const days = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (at: string | null | undefined, entry: Omit<DayEntry, "at">) => {
      if (!at) return;
      const d = new Date(at);
      if (Number.isNaN(d.getTime())) return;
      const key = dayKey(at);
      const list = map.get(key) ?? [];
      list.push({ ...entry, at });
      map.set(key, list);
    };
    for (const task of tasks) {
      if (task.isDone && task.completedAt) push(task.completedAt, { id: `task-${task.id}`, kind: "task", text: task.label });
    }
    for (const file of files) {
      if (file.createdAt) push(file.createdAt, { id: `file-${file.id}`, kind: "file", text: file.fileName ?? "Uploaded file" });
    }
    for (const entry of activity) {
      const at = (entry as JobActivity & { timestamp?: string }).timestamp ?? (entry as unknown as { createdAt?: string }).createdAt;
      if (at) push(at, { id: `event-${entry.id}`, kind: "event", text: entry.title });
    }
    return Array.from(map.entries())
      .map(([key, entries]) => ({ key, label: dayLabel(entries[0].at), entries: entries.sort((a, b) => a.at.localeCompare(b.at)) }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [tasks, files, activity]);

  const visibleDays = selectedDay ? days.filter((d) => d.key === selectedDay) : days;

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30"><CalendarDays className="h-5 w-5 text-emerald-300" /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Day by Day</h2>
            <p className="mt-1 text-sm text-slate-400">What happened on this job, grouped by day (Pacific). Pick a day to focus it.</p>
          </div>
        </div>
        {loading ? (<div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading activity…</div>) : days.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No dated activity yet. Completed checklist items, uploaded photos/files, and timeline events will appear here grouped by day.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedDay(null)} className={selectedDay === null ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/40" : "rounded-full bg-white/[0.04] px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10"}>All days</button>
              {days.map((d) => (<button key={d.key} type="button" onClick={() => setSelectedDay(d.key)} className={selectedDay === d.key ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/40" : "rounded-full bg-white/[0.04] px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10"}>{d.label}</button>))}
            </div>
            {visibleDays.map((d) => (
              <div key={d.key}>
                <h3 className="text-sm font-semibold text-slate-200">{d.label}</h3>
                <ul className="mt-2 space-y-1.5">
                  {d.entries.map((e) => (
                    <li key={e.id} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200">
                      {e.kind === "task" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : e.kind === "file" ? <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" /> : <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                      <span className="min-w-0 flex-1">{e.kind === "task" ? `Checklist completed: ${e.text}` : e.kind === "file" ? `Uploaded: ${e.text}` : e.text}</span>
                      <span className="shrink-0 text-xs text-slate-500">{timeFmt.format(new Date(e.at))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
