import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { SectionCard, EmptyState } from "@/components/atlas";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";
import type { ProblemJob, ProblemReason } from "../types/commandCenter";
import { formatScheduledDate } from "../utils/commandCenterUtils";

interface ProblemJobsWidgetProps {
  problemJobs: ProblemJob[];
}

const REASON_LABEL: Record<ProblemReason, string> = {
  late: "Late",
  unassigned: "Unassigned",
  on_hold: "On Hold",
};

const REASON_CLASS: Record<ProblemReason, string> = {
  late: "bg-danger/10 text-danger border-danger/20",
  unassigned: "bg-warning/10 text-warning border-warning/20",
  on_hold: "bg-orange-500/10 text-orange-300 border-orange-500/20",
};

const PRIORITY_BORDER: Record<string, string> = {
  High: "border-l-danger",
  Medium: "border-l-warning",
  Low: "border-l-border",
};

const MAX_PROBLEM_ROWS = 8;

function ReasonBadge({ reason }: { reason: ProblemReason }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        REASON_CLASS[reason],
      ].join(" ")}
    >
      {REASON_LABEL[reason]}
    </span>
  );
}

/**
 * ProblemJobsWidget — deduped, priority-sorted view of at-risk jobs.
 *
 * Combines late + unassigned + on-hold jobs. Each job may have multiple
 * reason badges (e.g. both Late and Unassigned). Sorted by priority then
 * late-first within each priority tier.
 *
 * Each row is one-click actionable to the job detail page.
 */
export function ProblemJobsWidget({ problemJobs }: ProblemJobsWidgetProps) {
  const visible = problemJobs.slice(0, MAX_PROBLEM_ROWS);
  const overflowCount = problemJobs.length - visible.length;

  return (
    <SectionCard
      title="Problem Jobs"
      description="Late, unassigned, and blocked work requiring immediate attention."
      actions={
        problemJobs.length > 0 ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
              {problemJobs.length}
            </span>
            <Link
              href={ROUTES.JOBS}
              className="text-xs font-medium text-primary transition-colors hover:text-white"
            >
              View all →
            </Link>
          </div>
        ) : null
      }
    >
      {problemJobs.length === 0 ? (
        <EmptyState
          title="No problem jobs — operations healthy!"
          description="No late, unassigned, or blocked jobs at this time."
          icon={<AlertTriangle className="h-5 w-5 text-success" />}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="space-y-1.5">
          {visible.map(({ job, reasons }) => {
            const borderClass =
              PRIORITY_BORDER[job.priority] ?? "border-l-border";

            return (
              <Link
                key={job.id}
                href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
                className={[
                  "group flex items-start gap-3 rounded-lg border border-default border-l-2 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-elevated",
                  borderClass,
                ].join(" ")}
              >
                {/* Title + customer */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-muted">
                      {job.jobNumber}
                    </span>
                    <span className="truncate text-sm font-medium text-primary group-hover:text-white">
                      {job.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{job.customerName}</p>
                </div>

                {/* Reason badges */}
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {reasons.map((r) => (
                    <ReasonBadge key={r} reason={r} />
                  ))}
                </div>

                {/* Scheduled date */}
                <span className="hidden shrink-0 text-right text-xs text-muted md:block">
                  {formatScheduledDate(job.scheduledFor)}
                </span>
              </Link>
            );
          })}

          {overflowCount > 0 && (
            <Link
              href={ROUTES.JOBS}
              className="block pt-1 text-xs text-muted transition-colors hover:text-primary"
            >
              + {overflowCount} more — View all →
            </Link>
          )}
        </div>
      )}
    </SectionCard>
  );
}
