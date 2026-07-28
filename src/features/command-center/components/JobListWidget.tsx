import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { SectionCard, EmptyState } from "@/components/atlas";
import type { Job } from "@/features/jobs/types/job";
import { CommandCenterJobRow } from "./CommandCenterJobRow";

/** Maximum job rows shown per widget before "View all →" truncates. */
const MAX_ROWS = 6;

interface JobListWidgetProps {
  title: string;
  jobs: Job[];
  viewAllHref: string;
  emptyTitle: string;
  emptyDescription: string;
  /** If true, the empty state signals a positive/healthy condition. */
  emptyIsGood?: boolean;
  /** Optional badge/tag to render next to each row. */
  rowBadges?: (job: Job) => React.ReactNode;
}

/**
 * JobListWidget — shared SectionCard shell used by all Command Center
 * queue widgets (Today's Jobs, In Progress, On Hold, etc.).
 *
 * Displays up to MAX_ROWS jobs, then provides a "View all →" link.
 * Fully server-rendered — no client state.
 */
export function JobListWidget({
  title,
  jobs,
  viewAllHref,
  emptyTitle,
  emptyDescription,
  emptyIsGood = false,
  rowBadges,
}: JobListWidgetProps) {
  const visibleJobs = jobs.slice(0, MAX_ROWS);
  const overflowCount = jobs.length - visibleJobs.length;

  const countBadge = (
    <span className="rounded-full border border-default bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
      {jobs.length}
    </span>
  );

  const viewAllLink =
    jobs.length > 0 ? (
      <Link
        href={viewAllHref}
        className="text-xs font-medium text-primary transition-colors hover:text-white"
      >
        View all →
      </Link>
    ) : null;

  return (
    <SectionCard
      title={title}
      actions={
        <div className="flex items-center gap-3">
          {countBadge}
          {viewAllLink}
        </div>
      }
    >
      {jobs.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={
            emptyIsGood ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : undefined
          }
          className="border-0 shadow-none"
        />
      ) : (
        <div className="divide-y divide-default -mx-4 sm:-mx-6">
          {visibleJobs.map((job) => (
            <CommandCenterJobRow
              key={job.id}
              job={job}
              badges={rowBadges?.(job)}
            />
          ))}
          {overflowCount > 0 && (
            <div className="px-3 py-2">
              <Link
                href={viewAllHref}
                className="text-xs text-muted transition-colors hover:text-primary"
              >
                + {overflowCount} more — View all →
              </Link>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
