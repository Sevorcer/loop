import Link from "next/link";

import { EmptyState, SectionCard } from "@/components/atlas";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { FeedItem } from "../types/liveOps";
import { formatClock } from "../utils/liveOpsUtils";

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <SectionCard title="Today's activity" description="Starts, completions, On The Way taps, assignments, notes, and photos — newest first.">
      {items.length === 0 ? (
        <EmptyState
          title="No field activity yet today"
          description="Updates appear here as techs tap On The Way, Start, and Complete in Loop."
        />
      ) : (
        <ol className="space-y-1">
          {items.map((entry) => (
            <li key={entry.id}>
              <Link
                href={ROUTE_BUILDERS.JOB_DETAIL(entry.jobId)}
                className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-surface-elevated"
              >
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted">{formatClock(entry.at)}</span>
                <span className="text-sm text-primary group-hover:text-white">{entry.label}</span>
                <span className="font-mono text-xs text-muted">{entry.jobNumber}</span>
                {entry.actorName ? <span className="text-xs text-muted">· {entry.actorName}</span> : null}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
