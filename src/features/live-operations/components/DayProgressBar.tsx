import { SectionCard } from "@/components/atlas";

import type { DayProgress } from "../types/liveOps";

const SEGMENTS: Array<{ key: keyof Omit<DayProgress, "total">; label: string; className: string }> = [
  { key: "completed", label: "Completed", className: "bg-green-500" },
  { key: "inProgress", label: "In Progress", className: "bg-amber-400" },
  { key: "onTheWay", label: "On The Way", className: "bg-sky-400" },
  { key: "scheduled", label: "Scheduled", className: "bg-slate-500" },
  { key: "onHold", label: "On Hold", className: "bg-red-500" },
];

export function DayProgressBar({ progress }: { progress: DayProgress }) {
  return (
    <SectionCard title="Today's progress" description="Every job scheduled today, by where it is right now.">
      {progress.total === 0 ? (
        <p className="text-sm text-muted">No jobs scheduled today.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5" role="img" aria-label="Today's job progress">
            {SEGMENTS.map((segment) =>
              progress[segment.key] > 0 ? (
                <div
                  key={segment.key}
                  className={segment.className}
                  style={{ width: `${(progress[segment.key] / progress.total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${segment.className}`} aria-hidden="true" />
                {segment.label} <span className="font-semibold text-primary">{progress[segment.key]}</span>
              </li>
            ))}
            <li className="ml-auto">
              Total <span className="font-semibold text-primary">{progress.total}</span>
            </li>
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
