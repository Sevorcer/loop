import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { EmptyState, SectionCard, StatusBadge } from "@/components/atlas";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { AttentionItem } from "../types/liveOps";

interface NeedsAttentionListProps {
  items: AttentionItem[];
  thresholdMinutes: number;
}

export function NeedsAttentionList({ items, thresholdMinutes }: NeedsAttentionListProps) {
  return (
    <SectionCard
      title="Needs attention"
      description={`Late to start or running long by ${thresholdMinutes}+ min, double-booked, on time off, unassigned, or left In Progress.`}
      actions={
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-default bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
            {items.length}
          </span>
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="Nothing slipping right now"
          description="Every job today is on time, staffed, and moving."
          icon={<CheckCircle2 className="h-6 w-6 text-green-400" />}
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((entry) => (
            <li key={entry.id}>
              <Link
                href={ROUTE_BUILDERS.JOB_DETAIL(entry.jobId)}
                className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-elevated"
              >
                <StatusBadge variant={entry.severity === "critical" ? "danger" : "warning"}>{entry.title}</StatusBadge>
                <span className="w-20 shrink-0 font-mono text-xs text-muted">{entry.jobNumber}</span>
                <span className="min-w-0 flex-1 basis-full text-sm text-primary group-hover:text-white sm:basis-auto">{entry.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
