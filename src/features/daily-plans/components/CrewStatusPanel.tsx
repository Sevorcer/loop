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
  if (availability === "unavailable") return "Unavailable";
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
            {crew.rosterOnly ? "On roster" : availabilityLabel(crew.availability)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {crew.truckName === "—" ? "No truck on file" : crew.truckName}
          {crew.helper ? ` · Helper: ${crew.helper}` : ""}
          {crew.departureTime !== "-" && crew.departureTime !== "—"
            ? ` · Departs ${crew.departureTime}`
            : ""}
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
 * Crew roster for the selected day. Empty when the company has no crews,
 * technicians, or assigned names on file.
 */
export function CrewStatusPanel({ crews, jobCountByTechnician }: CrewStatusPanelProps) {
  if (crews.length === 0) {
    return (
      <section aria-label="Crew Status">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
            Crew Status
          </h2>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
          No crews or technicians are on file yet. Add technicians in Settings, or assign someone to a job, and they will show up here.
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Crew Status">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          Crew Status
        </h2>
        <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
          {crews.length} crew{crews.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {crews.map((crew) => (
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
