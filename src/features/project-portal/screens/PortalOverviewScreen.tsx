"use client";

import { Clock, Calendar } from "lucide-react";

import { usePortal } from "../state/PortalProvider";
import { PortalEmptyState } from "../components/PortalErrorState";
import type { ProjectStatus, PortalChangeOrder } from "../types/portalTypes";
import { PORTAL_ROUTES } from "@/lib/routes";
import Link from "next/link";

// ─── Status Display ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  inspection_pending: "Inspection Pending",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: "text-slate-400 bg-slate-800/60",
  in_progress: "text-blue-300 bg-blue-900/40 ring-1 ring-blue-700/40",
  inspection_pending: "text-amber-300 bg-amber-900/40 ring-1 ring-amber-700/40",
  completed: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
  on_hold: "text-orange-300 bg-orange-900/40 ring-1 ring-orange-700/40",
  cancelled: "text-red-300 bg-red-900/40 ring-1 ring-red-700/40",
};

// ─── Change Order Card ────────────────────────────────────────────────────────

function ChangeOrderCard({ co }: { co: PortalChangeOrder }) {
  const approvedDate = new Date(co.approvedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const amountDollars = (co.approvedAmountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: co.currency,
  });

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-white">{co.title}</p>
        <p className="text-xs text-slate-500">
          {co.changeOrderNumber} · Approved {approvedDate}
        </p>
      </div>
      <p className="text-sm font-semibold text-emerald-400 shrink-0">{amountDollars}</p>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function PortalOverviewScreen() {
  const { project, milestones, appointments, changeOrders, currentProjectId, permissions } = usePortal();

  if (!project || !currentProjectId) {
    return (
      <PortalEmptyState
        heading="No project selected."
        body="Return to the portal home to select a project."
      />
    );
  }

  const completedMilestones = milestones.filter((m) => m.status === "completed").length;
  const totalMilestones = milestones.length;
  const nextAppointment = appointments[0] ?? null;

  const estimatedDate = project.estimatedCompletionDate
    ? new Date(project.estimatedCompletionDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div>
        <h1 className="text-xl font-semibold text-white sm:text-2xl">{project.name}</h1>
        <p className="mt-1 text-sm text-slate-400">{project.address}</p>
      </div>

      {/* Status + completion row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Status */}
        <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:col-span-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Status</p>
          <span
            className={[
              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_COLORS[project.status],
            ].join(" ")}
          >
            {STATUS_LABELS[project.status]}
          </span>
        </div>

        {/* Completion */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Complete</p>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-white">{project.completionPct}</span>
            <span className="mb-0.5 text-sm text-slate-400">%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${project.completionPct}%` }}
              role="progressbar"
              aria-valuenow={project.completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${project.completionPct}% complete`}
            />
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Milestones</p>
          <p className="text-2xl font-bold text-white">
            {completedMilestones}
            <span className="text-base text-slate-500">/{totalMilestones}</span>
          </p>
        </div>

        {/* Estimated completion */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Est. Complete</p>
          <p className="text-sm font-medium text-white">{estimatedDate ?? "TBD"}</p>
        </div>
      </div>

      {/* Next appointment */}
      {nextAppointment && permissions?.canViewAppointments ? (
        <section aria-label="Next appointment">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Upcoming Appointment
          </h2>
          <div className="flex items-start gap-3 rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
            <Calendar size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-400" />
            <div>
              <p className="font-medium text-white">{nextAppointment.appointmentType}</p>
              <p className="text-sm text-slate-300">
                {new Date(nextAppointment.scheduledDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                · {nextAppointment.scheduledWindow}
              </p>
              {nextAppointment.contactName ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  Contact: {nextAppointment.contactName}{" "}
                  {nextAppointment.contactPhone ? `· ${nextAppointment.contactPhone}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Next milestone */}
      {project.nextMilestone ? (
        <section aria-label="Next milestone">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Next Milestone
          </h2>
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            <Clock size={16} aria-hidden="true" className="shrink-0 text-slate-400" />
            <p className="font-medium text-white">{project.nextMilestone}</p>
          </div>
        </section>
      ) : null}

      {/* Project manager */}
      <section aria-label="Project manager">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Project Manager
        </h2>
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
            {project.projectManager.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">{project.projectManager}</p>
          </div>
          <Link
            href={PORTAL_ROUTES.CONTACT(currentProjectId)}
            className="text-xs text-blue-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
          >
            View team
          </Link>
        </div>
      </section>

      {/* Approved change orders */}
      {changeOrders.length > 0 && permissions?.canViewChangeOrders ? (
        <section aria-label="Approved change orders">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Approved Change Orders
          </h2>
          <div className="space-y-2">
            {changeOrders.map((co) => (
              <ChangeOrderCard key={co.id} co={co} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
