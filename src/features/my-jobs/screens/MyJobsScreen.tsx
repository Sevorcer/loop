import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, MapPin, Navigation, Users } from "lucide-react";

import { EmptyState, PhoneLink, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { buildDirectionsUrl } from "@/features/jobs/utils/jobMobileActions";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";

import { countDone, formatCardTime, pickCurrentJobId, type MyJobCard } from "../utils/myJobs";

function statusVariant(status: MyJobCard["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "Scheduled") return "info" as const;
  return "neutral" as const;
}

interface MyJobsScreenProps {
  todayLabel: string;
  cards: MyJobCard[];
}

/** My Jobs tab: the signed-in user's jobs for today, in time order. */
export function MyJobsScreen({ todayLabel, cards }: MyJobsScreenProps) {
  const done = countDone(cards);
  const currentId = pickCurrentJobId(cards);
  const percent = cards.length > 0 ? Math.round((done / cards.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <SurfaceCard className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
            <p className="mt-1 text-lg font-semibold text-white">{todayLabel}</p>
          </div>
          {cards.length > 0 ? (
            <StatusBadge variant={done === cards.length ? "success" : "info"}>
              {done} of {cards.length} done
            </StatusBadge>
          ) : null}
        </div>
        {cards.length > 0 ? (
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-label="Jobs done today"
            aria-valuemin={0}
            aria-valuemax={cards.length}
            aria-valuenow={done}
          >
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </SurfaceCard>

      {cards.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No jobs on your board today"
          description="Nothing is assigned to you for today. If you think that's wrong, check with the office."
          action={
            <Link href={ROUTES.JOBS}>
              <Button variant="secondary">See all jobs</Button>
            </Link>
          }
        />
      ) : (
        <ol className="space-y-3" aria-label="Your jobs today">
          {cards.map((card) => (
            <MyJobItem key={card.id} card={card} isCurrent={card.id === currentId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function MyJobItem({ card, isCurrent }: { card: MyJobCard; isCurrent: boolean }) {
  const href = ROUTE_BUILDERS.JOB_DETAIL(card.id);
  const directions = buildDirectionsUrl(card.location);
  const isDone = card.status === "Completed";

  return (
    <li
      data-current={isCurrent ? "true" : undefined}
      className={[
        "rounded-2xl border p-4",
        isCurrent ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/10 bg-white/[0.03]",
        isDone ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="text-sm font-semibold text-white">{formatCardTime(card.startAt)}</span>
            <span>· {card.jobNumber}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-white">{card.customerName}</p>
          <p className="mt-0.5 text-xs text-slate-400">{card.title}</p>
        </div>
        {isDone ? <CheckCircle2 aria-label="Done" className="h-5 w-5 shrink-0 text-emerald-400" /> : null}
      </div>

      {card.street || card.city ? (
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-300">
          <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span>{[card.street, card.city].filter(Boolean).join(" · ")}</span>
        </p>
      ) : null}

      {card.withNames.length > 0 ? (
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <Users aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
          With {card.withNames.join(", ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge variant={statusVariant(card.status)}>{card.status}</StatusBadge>
        {card.type ? <StatusBadge variant="neutral">{card.type}</StatusBadge> : null}
      </div>

      {isCurrent ? (
        <div className="mt-4 flex gap-2">
          <Link href={href} className="flex-1">
            <Button variant="primary" className="w-full">
              Open job <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              aria-label="Directions"
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-200 hover:bg-white/10"
            >
              <Navigation className="h-4 w-4" />
            </a>
          ) : null}
          {card.phone ? (
            <PhoneLink
              phone={card.phone}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/10"
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <Link
            href={href}
            aria-label={`Open ${card.jobNumber}`}
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </li>
  );
}
