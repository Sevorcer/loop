import Link from "next/link";

import { EmptyState, SectionCard, StatusBadge } from "@/components/atlas";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { AttentionKind, TechCard, TechState } from "../types/liveOps";
import { formatClock } from "../utils/liveOpsUtils";

const STATE_LABEL: Record<TechState, string> = {
  on_job: "On a job",
  on_the_way: "On the way",
  between_jobs: "Between jobs",
  not_started: "Not started",
  done: "Done for the day",
  free: "No jobs today",
  off_today: "Off today",
};

const STATE_VARIANT: Record<TechState, "success" | "warning" | "danger" | "info" | "neutral"> = {
  on_job: "warning",
  on_the_way: "info",
  between_jobs: "info",
  not_started: "neutral",
  done: "success",
  free: "neutral",
  off_today: "neutral",
};

const KIND_LABEL: Record<AttentionKind, string> = {
  late_start: "Late start",
  running_long: "Running long",
  stuck_in_progress: "Left In Progress",
  double_booked: "Double-booked",
  assigned_on_time_off: "On time off",
  unassigned: "Unassigned",
  on_hold: "On Hold",
};

function TechCardView({ card }: { card: TechCard }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-primary">{card.name}</p>
        <StatusBadge variant={STATE_VARIANT[card.state]}>{STATE_LABEL[card.state]}</StatusBadge>
      </div>

      <dl className="space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-muted">Now</dt>
          <dd className="min-w-0 truncate text-primary">
            {card.currentJob ? (
              <Link href={ROUTE_BUILDERS.JOB_DETAIL(card.currentJob.id)} className="hover:text-white hover:underline">
                <span className="font-mono">{card.currentJob.jobNumber}</span> · {card.currentJob.customerName}
                {card.currentJob.at ? (
                  <span className="text-muted">
                    {" "}
                    · {card.state === "on_the_way" ? "left" : "since"} {formatClock(card.currentJob.at)}
                  </span>
                ) : null}
              </Link>
            ) : (
              <span className="text-muted">—</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-muted">Next</dt>
          <dd className="min-w-0 truncate text-primary">
            {card.nextJob ? (
              <Link href={ROUTE_BUILDERS.JOB_DETAIL(card.nextJob.id)} className="hover:text-white hover:underline">
                {card.nextJob.at ? `${formatClock(card.nextJob.at)} · ` : ""}
                <span className="font-mono">{card.nextJob.jobNumber}</span> · {card.nextJob.customerName}
              </Link>
            ) : (
              <span className="text-muted">—</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-muted">Today</dt>
          <dd className="text-primary">
            {card.jobsDone} of {card.jobsToday} done
          </dd>
        </div>
      </dl>

      {card.attentionKinds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {card.attentionKinds.map((kind) => (
            <span key={kind} className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">
              {KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TechBoard({ techs }: { techs: TechCard[] }) {
  return (
    <SectionCard title="Techs right now" description="One card per person. A shared job shows on every tech assigned to it.">
      {techs.length === 0 ? (
        <EmptyState title="No techs on today's schedule" description="Nobody is assigned to a job today." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {techs.map((card) => (
            <TechCardView key={card.personId} card={card} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
