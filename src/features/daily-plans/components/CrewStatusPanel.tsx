import Link from "next/link";
import { Users } from "lucide-react";

import type { Job } from "@/features/jobs/types/job";
import type { CrewProfile } from "../types/dailyPlan";
import type { CrewGroup } from "../data/fieldCrews";
import { formatJobDayTime, customerSiteLabel } from "../utils/dayPlanHelpers";

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

function JobRunList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-14 shrink-0 tabular-nums text-slate-500">
            {formatJobDayTime(job)}
          </span>
          <Link href={`/jobs/${job.id}`} className="truncate text-slate-300 hover:text-white hover:underline">
            {job.jobNumber} · {customerSiteLabel(job)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface CrewRowProps {
  crew: CrewProfile;
  jobCount: number;
  jobs: Job[];
  members: string[];
}

function CrewRow({ crew, jobCount, jobs, members }: CrewRowProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
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
            {crew.truckName === "—" ? "No truck on file" : crew.truckName}
            {members.length > 0 ? ` · ${members.join(", ")}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-white">{jobCount}</p>
          <p className="text-[11px] text-slate-500">{jobCount === 1 ? "job" : "jobs"}</p>
        </div>
      </div>
      <JobRunList jobs={jobs} />
    </div>
  );
}

function FloaterRow({ name, jobCount, jobs }: { name: string; jobCount: number; jobs: Job[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-white">{name}</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-white">{jobCount}</p>
          <p className="text-[11px] text-slate-500">{jobCount === 1 ? "job" : "jobs"}</p>
        </div>
      </div>
      <JobRunList jobs={jobs} />
    </div>
  );
}

interface CrewStatusPanelProps {
  crewGroups: CrewGroup[];
  floaters: string[];
  jobCountByTechnician: Record<string, number>;
  /** Optional: jobs keyed by technician name for the day's run list. */
  jobsByTechnician?: Record<string, Job[]>;
}

/**
 * Crew roster for the selected day. Shows only people assigned to that day's
 * jobs, grouped under their crew record. Floaters appear in an "Also working
 * today" group with no invented truck, availability, or departure fields.
 */
export function CrewStatusPanel({
  crewGroups,
  floaters,
  jobCountByTechnician,
  jobsByTechnician = {},
}: CrewStatusPanelProps) {
  const totalCount = crewGroups.length + floaters.length;

  if (totalCount === 0) {
    return (
      <section aria-label="Crew Status">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Users className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
            Crew Status
          </h2>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
          No one is assigned to jobs today.
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
          {totalCount} group{totalCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {crewGroups.map((group) => {
          const memberJobs = new Map<string, Job>();
          for (const member of group.assignedMembers) {
            for (const job of jobsByTechnician[member] ?? []) {
              memberJobs.set(job.id, job);
            }
          }
          const jobs = Array.from(memberJobs.values());
          const jobCount = group.assignedMembers.reduce(
            (sum, name) => sum + (jobCountByTechnician[name] ?? 0),
            0,
          );
          return (
            <CrewRow
              key={group.crew.id}
              crew={group.crew}
              jobCount={jobs.length || jobCount}
              jobs={jobs}
              members={group.assignedMembers}
            />
          );
        })}
      </div>

      {floaters.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            Also working today
          </p>
          <div className="space-y-2">
            {floaters.map((name) => (
              <FloaterRow
                key={name}
                name={name}
                jobCount={jobCountByTechnician[name] ?? 0}
                jobs={jobsByTechnician[name] ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
