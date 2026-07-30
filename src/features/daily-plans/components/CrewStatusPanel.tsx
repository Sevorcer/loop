import { Users } from "lucide-react";

import type { CrewProfile } from "../types/dailyPlan";

function getAvailabilityClasses(availability: CrewProfile["availability"]): string {
  if (availability === "available") {
    return "border-green-500/20 bg-green-500/10 text-green-300";
  }
  if (availability === "late arrival" || availability === "half day") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }
  return "border-red-500/20 bg-red-500/10 text-red-300";
}

function availabilityLabel(availability: CrewProfile["availability"]): string {
  if (availability === "available") return "Available";
  if (availability === "late arrival") return "Late arrival";
  if (availability === "half day") return "Half day";
  if (availability === "training") return "Training";
  if (availability === "vacation") return "Vacation";
  return "Sick";
}

interface CrewRowProps {
  crew: CrewProfile;
  jobCount: number;
}

function CrewRow({ crew, jobCount }: CrewRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white">{crew.leadInstaller}</span>
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              getAvailabilityClasses(crew.availability),
            ].join(" ")}
          >
            {availabilityLabel(crew.availability)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {crew.truckName}
          {crew.helper ? ` · Helper: ${crew.helper}` : " · Solo route"}
          {crew.departureTime !== "-" ? ` · Departs ${crew.departureTime}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-white">{jobCount}</p>
        <p className="text-[11px] text-slate-500">{jobCount === 1 ? "job" : "jobs"}</p>
      </div>
    </div>
  );
}

interface CrewStatusPanelProps {
  crews: CrewProfile[];
  jobCountByTechnician: Record<string, number>;
}

/**
 * Compact crew status panel. Shows active crews (excludes vacation/sick).
 * Vacation and sick crews are surfaced in the Needs Attention panel or
 * alerts, not here — this panel is for operational context only.
 */
export function CrewStatusPanel({ crews, jobCountByTechnician }: CrewStatusPanelProps) {
  const activeCrews = crews.filter(
    (c) => c.availability !== "vacation" && c.availability !== "sick"
  );

  if (activeCrews.length === 0) return null;

  return (
    <section aria-label="Crew Status">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          Crew Status
        </h2>
        <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
          {activeCrews.length} crew{activeCrews.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {activeCrews.map((crew) => (
          <CrewRow
            key={crew.id}
            crew={crew}
            jobCount={jobCountByTechnician[crew.technician] ?? 0}
          />
        ))}
      </div>
    </section>
  );
}
