import { Users } from "lucide-react";

import { SectionCard, EmptyState } from "@/components/atlas";
import type { CrewWorkloadEntry } from "../types/commandCenter";

interface CrewWorkloadWidgetProps {
  crewWorkload: CrewWorkloadEntry[];
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
 * CrewWorkloadWidget — aggregated crew load table.
 *
 * Columns: Technician | Assigned | In Progress | At Risk
 * At-risk = jobs that are late OR on hold.
 *
 * Crew identity is derived from job.assigned_to (text field) until
 * FK-linked crew records are available (Sprint 8 deferred).
 */
export function CrewWorkloadWidget({ crewWorkload }: CrewWorkloadWidgetProps) {
  return (
    <SectionCard
      title="Crew Workload"
      description="Active jobs per technician. At-risk includes late and on-hold jobs."
    >
      {crewWorkload.length === 0 ? (
        <EmptyState
          title="No crew data"
          description="No technicians have assigned jobs at this time."
          icon={<Users className="h-5 w-5 text-muted-foreground" />}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-default">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Technician
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
              {crewWorkload.map((entry) => (
                <tr
                  key={entry.technicianName}
                  className={
                    entry.atRiskCount > 0
                      ? "bg-danger/5"
                      : "hover:bg-surface-elevated"
                  }
                >
                  <td className="py-2.5 pr-4 font-medium text-primary">
                    {entry.technicianName}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted">
                    {entry.assignedCount}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {entry.inProgressCount > 0 ? (
                      <span className="font-medium text-warning">
                        {entry.inProgressCount}
                      </span>
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
