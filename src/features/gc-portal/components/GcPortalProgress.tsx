"use client";

/**
 * GcPortalProgress — GC Portal v2
 *
 * Progress timeline showing milestones: Scheduled -> In Progress -> Completed.
 * Each milestone shows a dot and optional date.
 */

import { CheckCircle2, Circle } from "lucide-react";

import type { PortalMilestone } from "../types/gcPortal";

interface GcPortalProgressProps {
  milestones: PortalMilestone[];
}

export function GcPortalProgress({ milestones }: GcPortalProgressProps) {
  if (milestones.length === 0) return null;

  // Find the last reached milestone index
  let lastReachedIndex = -1;
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (milestones[i].reached) {
      lastReachedIndex = i;
      break;
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Progress</h2>

      <div className="rounded-lg border border-border bg-surface px-4 py-5">
        <div className="flex items-center justify-between">
          {milestones.map((milestone, index) => (
            <div key={milestone.label} className="flex flex-1 items-center">
              {/* Milestone dot */}
              <div className="flex flex-col items-center gap-1.5">
                {milestone.reached ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground/40" />
                )}
                <span
                  className={`text-xs font-medium ${
                    milestone.reached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {milestone.label}
                </span>
                {milestone.date && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(milestone.date)}
                  </span>
                )}
              </div>

              {/* Connector line between milestones */}
              {index < milestones.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full ${
                    index < lastReachedIndex
                      ? "bg-emerald-400/60"
                      : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
