"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

import { useCurrentRole } from "@/features/auth";
import type { Job } from "@/features/jobs/types/job";
import { requestJson } from "@/lib/api/client";

import { DayJobsTable } from "../components/DayJobsTable";
import {
  buildDailyCrewRoster,
  type CrewRecord,
} from "../data/fieldCrews";
import { useDailyPlans } from "../state/DailyPlansProvider";
import {
  canViewDailyPlans,
  formatJobDayTime,
  getJobsForSelectedDate,
  jobAssigneeNames,
  jobAddressForPrint,
  customerSiteLabel,
} from "../utils/dayPlanHelpers";
import { formatPlanDate, getTodayDate } from "../utils/planUtils";

/**
 * Printable morning handout. Opened at /daily-plans/print?date=YYYY-MM-DD.
 * Uses @media print; no interactive assign controls.
 */
export function PrintDailyPlanScreen() {
  const params = useSearchParams();
  const { role } = useCurrentRole();
  const { getNote, getPlanActivation, getPacketsSent, getPlanStatus } = useDailyPlans();

  const dateParam = params.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getTodayDate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [crews, setCrews] = useState<CrewRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role || !canViewDailyPlans(role)) return;
    let cancelled = false;
    void (async () => {
      try {
        const [jobsRes, rosterRes] = await Promise.all([
          requestJson<{ jobs: Job[] }>(
            `/api/daily-plans/jobs?from=${date}&to=${date}`,
            { role, cache: "no-store" },
          ),
          requestJson<{ crews: CrewRecord[] }>("/api/field-roster", {
            role,
            cache: "no-store",
          }),
        ]);
        if (cancelled) return;
        setJobs(jobsRes.jobs ?? []);
        setCrews(rosterRes.crews ?? []);
        setHydrated(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load print view.");
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, date]);

  const dayJobs = useMemo(() => getJobsForSelectedDate(jobs, date), [jobs, date]);
  const assignedNames = useMemo(
    () => dayJobs.flatMap((job) => jobAssigneeNames(job)),
    [dayJobs],
  );
  const roster = useMemo(
    () => buildDailyCrewRoster({ crews, assignedNames }),
    [crews, assignedNames],
  );

  const note = getNote(date);
  const activation = getPlanActivation(date);
  const packetsSent = getPacketsSent(date);
  const status = getPlanStatus(date);

  if (role && !canViewDailyPlans(role)) {
    return (
      <div className="p-8 text-sm text-slate-300">
        Daily Plans print is for office and dispatch only.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 print:max-w-none print:space-y-4 print:p-0">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          nav, aside, [data-slot="sidebar"], [data-print-hide] { display: none !important; }
          body { background: white !important; color: black !important; }
          a { color: black !important; text-decoration: none !important; }
        }
      `}} />

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden" data-print-hide>
        <div>
          <h1 className="text-xl font-semibold text-white">Print preview</h1>
          <p className="text-sm text-slate-400">Use your browser print dialog for the shop board.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white hover:bg-white/10"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <header className="border-b border-white/10 pb-4 print:border-black">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 print:text-black">
          Legacy One Heating
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white print:text-black">
          Daily Plan — {formatPlanDate(date)}
        </h1>
      </header>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !hydrated ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400 print:text-black">
              Jobs
            </h2>
            <DayJobsTable
              jobs={dayJobs}
              crews={crews}
              people={[]}
              canEdit={false}
              onAssignPeople={() => {}}
              printMode
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400 print:text-black">
              Crews
            </h2>
            {roster.crewGroups.length === 0 && roster.floaters.length === 0 ? (
              <p className="text-sm text-slate-400 print:text-black">No one assigned yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {roster.crewGroups.map((group) => {
                  const memberJobs = dayJobs.filter((job) =>
                    jobAssigneeNames(job).some((name) =>
                      group.assignedMembers.some(
                        (member) => member.toLowerCase() === name.toLowerCase(),
                      ),
                    ),
                  );
                  return (
                    <div
                      key={group.crew.id}
                      className="rounded-2xl border border-white/10 p-4 print:border-black"
                    >
                      <p className="font-semibold text-white print:text-black">
                        {group.crew.leadInstaller}
                      </p>
                      <p className="text-xs text-slate-400 print:text-black">
                        Truck: {group.crew.truckName}
                        {group.assignedMembers.length > 1
                          ? ` · Helpers: ${group.assignedMembers
                              .filter((n) => n !== group.crew.leadInstaller)
                              .join(", ")}`
                          : ""}
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-300 print:text-black">
                        {memberJobs.map((job) => (
                          <li key={job.id}>
                            {formatJobDayTime(job)} · {job.jobNumber} ·{" "}
                            {customerSiteLabel(job)} · {jobAddressForPrint(job)}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
                {roster.floaters.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 p-4 print:border-black">
                    <p className="font-semibold text-white print:text-black">Also working today</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300 print:text-black">
                      {roster.floaters.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 p-4 print:border-black">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400 print:text-black">
              Notes
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200 print:text-black">
              {note.trim() || "No notes for this day."}
            </p>
          </section>

          <footer className="border-t border-white/10 pt-3 text-xs text-slate-400 print:border-black print:text-black">
            Packets sent: {packetsSent ? "yes" : "no"} · Activated:{" "}
            {status === "active" && activation?.startedAt
              ? new Date(activation.startedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "not yet"}
          </footer>
        </>
      )}
    </div>
  );
}
