import type { LiveOpsHero } from "../types/liveOps";
import { formatClock } from "../utils/liveOpsUtils";

const HEALTH_CLASS: Record<LiveOpsHero["health"], string> = {
  healthy: "border-green-500/30 bg-green-500/10 text-green-200",
  minor_issues: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  needs_attention: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  critical: "border-red-500/30 bg-red-500/10 text-red-200",
};

interface LiveHeroProps {
  hero: LiveOpsHero;
  dayStartedAt: string | null;
}

/** Top strip: how the day is going right now. Health is folded in as a badge. */
export function LiveHero({ hero, dayStartedAt }: LiveHeroProps) {
  const tiles = [
    { label: "Techs on a job", value: hero.techsWorking },
    { label: "On the way", value: hero.techsOnTheWay },
    { label: "Jobs in progress", value: hero.jobsRunning },
    { label: "Late or running long", value: hero.lateOrLong, alert: hero.lateOrLong > 0 },
    { label: "Needs attention", value: hero.attentionCount, alert: hero.criticalCount > 0 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 font-semibold ${HEALTH_CLASS[hero.health]}`}>
          {hero.healthLabel}
        </span>
        {dayStartedAt ? (
          <span className="text-muted">Day started {formatClock(dayStartedAt)}</span>
        ) : null}
        <span className="text-muted">
          {hero.lastActivityAt ? `Last field update ${formatClock(hero.lastActivityAt)}` : "No field updates yet today"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-default bg-border sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 bg-surface px-4 py-4 last:col-span-2 sm:last:col-span-1">
            <span className={`text-2xl font-semibold ${tile.alert ? "text-danger" : "text-primary"}`}>{tile.value}</span>
            <span className="text-xs text-muted">{tile.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
