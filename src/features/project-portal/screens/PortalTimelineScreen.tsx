"use client";

import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

import { usePortal } from "../state/PortalProvider";
import { PortalEmptyState } from "../components/PortalErrorState";
import type { MilestoneStatus, PortalMilestone } from "../types/portalTypes";

// ─── Milestone Icon ───────────────────────────────────────────────────────────

function MilestoneIcon({ status }: { status: MilestoneStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={18} className="text-emerald-400 shrink-0" aria-hidden="true" />;
    case "in_progress":
      return <Clock size={18} className="text-blue-400 shrink-0 animate-pulse" aria-hidden="true" />;
    case "skipped":
      return <AlertCircle size={18} className="text-slate-600 shrink-0" aria-hidden="true" />;
    default:
      return <Circle size={18} className="text-slate-700 shrink-0" aria-hidden="true" />;
  }
}

// ─── Milestone Row ────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  isLast,
}: {
  milestone: PortalMilestone;
  isLast: boolean;
}) {
  const completedDate = milestone.completedAt
    ? new Date(milestone.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const statusLabel =
    milestone.status === "completed"
      ? `Completed ${completedDate ?? ""}`
      : milestone.status === "in_progress"
      ? "In progress"
      : milestone.status === "skipped"
      ? "Skipped"
      : "Pending";

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div
          aria-hidden="true"
          className="absolute left-[8px] top-7 h-full w-px bg-slate-800"
        />
      )}

      {/* Icon column */}
      <div className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <MilestoneIcon status={milestone.status} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <p
            className={[
              "font-medium",
              milestone.status === "completed" ? "text-white" : "text-slate-400",
            ].join(" ")}
          >
            {milestone.name}
          </p>
          <span
            className={[
              "text-xs",
              milestone.status === "completed"
                ? "text-slate-500"
                : milestone.status === "in_progress"
                ? "text-blue-400"
                : "text-slate-600",
            ].join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        {milestone.notes ? (
          <p className="mt-1 text-sm text-slate-400">{milestone.notes}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PortalTimelineScreen() {
  const { milestones, permissions } = usePortal();

  if (!permissions?.canViewTimeline) {
    return (
      <PortalEmptyState
        heading="Timeline not available."
        body="Your account doesn't have access to the project timeline."
      />
    );
  }

  if (milestones.length === 0) {
    return (
      <PortalEmptyState
        heading="No timeline activity yet."
        body="Your project timeline will appear here as work progresses. Check back soon."
        ctaLabel="Contact Team"
        ctaHref="contact"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Timeline</h1>
        <p className="mt-1 text-sm text-slate-400">
          {milestones.filter((m) => m.status === "completed").length} of{" "}
          {milestones.length} milestones completed
        </p>
      </div>

      <section aria-label="Project milestones">
        <div role="list" aria-label="Milestone list">
          {milestones.map((milestone, i) => (
            <div key={milestone.id} role="listitem">
              <MilestoneRow
                milestone={milestone}
                isLast={i === milestones.length - 1}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
