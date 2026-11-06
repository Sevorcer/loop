import type { Job } from "@/features/jobs/types/job";

const JOB_TYPE_CARD: Record<Job["type"], string> = {
  Install: "border-blue-400/40 border-l-blue-400 bg-blue-500/15",
  Service: "border-emerald-400/40 border-l-emerald-400 bg-emerald-500/15",
  Maintenance: "border-amber-400/40 border-l-amber-400 bg-amber-500/15",
  Inspection: "border-violet-400/40 border-l-violet-400 bg-violet-500/15",
  Estimate: "border-slate-400/40 border-l-slate-400 bg-slate-500/15",
  Callback: "border-rose-400/40 border-l-rose-400 bg-rose-500/15",
};

/**
 * Completed jobs drop the job-type tint for the pink "completed" treatment (the
 * --completed token) so finished work reads at a glance on the month grid. It is
 * not dimmed: completed cards stay fully readable.
 */
const COMPLETED_CARD = "completed-card";

/** Card color classes for a job: pink when completed, else by job type. */
export function calendarJobCardTone(job: Pick<Job, "status" | "type">): string {
  if (job.status === "Completed") return COMPLETED_CARD;
  return JOB_TYPE_CARD[job.type] ?? "border-white/15 border-l-slate-400 bg-white/[0.04]";
}
