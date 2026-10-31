"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import { SectionCard, EmptyState } from "@/components/atlas";
import type { WorkloadEntry } from "../types/commandCenter";

interface CrewWorkloadWidgetProps {
  personWorkload: WorkloadEntry[];
  teamWorkload: WorkloadEntry[];
  initialMode?: "people" | "teams";
}

function AtRiskIndicator({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
      {count}
    </span>
  );
}

/**
 * Workload for open jobs. People is the default. Teams groups everyone
 * assigned to the same job.
 */
export function CrewWorkloadWidget({
  personWorkload,
  teamWorkload,
  initialMode = "people",
}: CrewWorkloadWidgetProps) {
  const [mode, setMode] = useState<"people" | "teams">(initialMode);
  const rows = mode === "people" ? personWorkload : teamWorkload;
  const noun = mode === "people" ? "Person" : "Team";

  return (
    <SectionCard
      title="Workload"
      description="Open jobs by person. Teams shows the people assigned to a job together. At-risk includes late and on-hold jobs."
      actions={
        <div className="flex gap-2" role="group" aria-label="Workload grouping">
          <ModeButton pressed={mode === "people"} onClick={() => setMode("people")}>
            People
          </ModeButton>
          <ModeButton pressed={mode === "teams"} onClick={() => setMode("teams")}>
            Teams
          </ModeButton>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title={mode === "people" ? "No one is assigned" : "No teams"}
          description="Open jobs with people assigned will show up here."
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="min-w-0">
          <ul className="space-y-2 md:hidden">
            {rows.map((entry) => (
              <li
                key={entry.key}
                className={
                  entry.atRiskCount > 0
                    ? "rounded-xl bg-danger/5 px-3 py-3"
                    : "rounded-xl px-3 py-3"
                }
              >
                <p className="text-sm font-medium text-primary">{entry.label}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Assigned
                    </dt>
                    <dd className="mt-1 text-sm text-muted">{entry.assignedCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      In Progress
                    </dt>
                    <dd className="mt-1 text-sm">
                      {entry.inProgressCount > 0 ? (
                        <span className="font-medium text-warning">{entry.inProgressCount}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      At Risk
                    </dt>
                    <dd className="mt-1">
                      <AtRiskIndicator count={entry.atRiskCount} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-default">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {noun}
                </th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Assigned
                </th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  In Progress
                </th>
                <th className="py-2 pl-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  At Risk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {rows.map((entry) => (
                <tr
                  key={entry.key}
                  className={entry.atRiskCount > 0 ? "bg-danger/5" : "hover:bg-surface-elevated"}
                >
                  <td className="py-2.5 pr-4 font-medium text-primary">{entry.label}</td>
                  <td className="py-2.5 px-3 text-right text-muted">{entry.assignedCount}</td>
                  <td className="py-2.5 px-3 text-right">
                    {entry.inProgressCount > 0 ? (
                      <span className="font-medium text-warning">{entry.inProgressCount}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <AtRiskIndicator count={entry.atRiskCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ModeButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-sm md:min-h-10 ${
        pressed ? "border-default bg-surface-elevated text-foreground" : "border-default text-muted"
      }`}
    >
      {children}
    </button>
  );
}
