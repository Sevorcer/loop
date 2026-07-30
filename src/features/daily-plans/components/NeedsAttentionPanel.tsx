import Link from "next/link";
import { AlertTriangle, ArrowRight, MapPin, UserX } from "lucide-react";

import type { Job } from "@/features/jobs/types/job";
import { getTodayDate } from "../utils/planUtils";

type AttentionReason = "unassigned" | "on-hold" | "overdue" | "blocked";

interface AttentionJob {
  job: Job;
  reason: AttentionReason;
}

function getReasonLabel(reason: AttentionReason): string {
  if (reason === "unassigned") return "Unassigned";
  if (reason === "on-hold") return "On Hold";
  if (reason === "overdue") return "Overdue";
  return "Blocked";
}

function getReasonClasses(reason: AttentionReason): string {
  if (reason === "unassigned") {
    return "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";
  }
  if (reason === "on-hold" || reason === "blocked") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  return "border-orange-500/25 bg-orange-500/10 text-orange-300";
}

function AttentionRow({ job, reason }: AttentionJob) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{job.jobNumber}</span>
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              getReasonClasses(reason),
            ].join(" ")}
          >
            {reason === "unassigned" ? (
              <UserX className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {getReasonLabel(reason)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-white">{job.title}</p>
        {job.location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
            <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
            {job.location}
          </p>
        ) : null}
      </div>

      <Link
        href={`/jobs/${job.id}`}
        aria-label={`Open ${job.jobNumber}: ${job.title}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
      >
        Open
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

interface NeedsAttentionPanelProps {
  jobs: Job[];
}

/**
 * Derives attention reasons from the job list and renders a compact panel.
 * Priority order: overdue → on-hold → unassigned (today) → any remaining.
 */
export function NeedsAttentionPanel({ jobs }: NeedsAttentionPanelProps) {
  const today = getTodayDate();

  const attentionItems: AttentionJob[] = jobs
    .map((job): AttentionJob | null => {
      if (job.scheduledFor && job.scheduledFor < today && job.status !== "Completed" && job.status !== "Cancelled") {
        return { job, reason: "overdue" };
      }
      if (job.status === "On Hold") {
        return { job, reason: "on-hold" };
      }
      if (!job.assignedTo.trim()) {
        return { job, reason: "unassigned" };
      }
      return null;
    })
    .filter((item): item is AttentionJob => item !== null)
    // Sort: overdue first, then on-hold, then unassigned
    .sort((a, b) => {
      const order: Record<AttentionReason, number> = {
        overdue: 0,
        "on-hold": 1,
        blocked: 2,
        unassigned: 3,
      };
      return order[a.reason] - order[b.reason];
    });

  if (attentionItems.length === 0) return null;

  return (
    <section aria-label="Needs Attention">
      <div className="mb-3 flex items-center gap-2 px-1">
        <AlertTriangle className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          Needs Attention
        </h2>
        <span className="ml-auto rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-300">
          {attentionItems.length} item{attentionItems.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {attentionItems.map(({ job, reason }) => (
          <AttentionRow key={job.id} job={job} reason={reason} />
        ))}
      </div>
    </section>
  );
}
