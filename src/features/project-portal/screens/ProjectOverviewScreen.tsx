"use client";

import { Calendar, CheckCircle2, Clock, MapPin, User } from "lucide-react";

import { StaleBanner } from "../components/StaleBanner";
import { usePortal } from "../state/PortalProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    not_started: {
      label: "Not Started",
      className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    },
    in_progress: {
      label: "In Progress",
      className: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    },
    on_hold: {
      label: "On Hold",
      className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    },
    completed: {
      label: "Completed",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-red-500/10 text-red-300 border-red-500/20",
    },
  };
  const { label, className } = config[status] ?? config.not_started;
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function CompletionBar({ percent }: { percent: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Completion</span>
        <span className="text-xs font-semibold text-foreground">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Project ${percent}% complete`}
        />
      </div>
    </div>
  );
}

/**
 * Project Overview screen — Sprint 22A MVP.
 *
 * Displays:
 * - Project status and completion percentage
 * - Estimated completion date
 * - Next milestone
 * - Assigned project manager
 * - Last updated timestamp
 * - Upcoming appointments
 * - Approved change orders
 * - Stale banner when freshness SLA is exceeded
 */
export function ProjectOverviewScreen() {
  const { projection, permissionSet } = usePortal();
  const { project, appointments, changeOrders, freshness } = projection;

  if (!project) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stale banner */}
      <StaleBanner freshness={freshness} />

      {/* Project header card */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">
              {project.name}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{project.address}</span>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <CompletionBar percent={project.completionPercent} />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Est. Completion</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {formatDate(project.estimatedCompletionDate)}
              </p>
            </div>
          </div>
          {project.nextMilestone ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Next Milestone</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {project.nextMilestone}
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Project Manager</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {project.projectManagerName}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Last synchronized{" "}
          {freshness.minutesSinceSync < 1
            ? "just now"
            : `${freshness.minutesSinceSync} min ago`}
        </p>
      </div>

      {/* Upcoming appointments */}
      {permissionSet?.canViewAppointments && appointments.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming Appointments
          </h3>
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {appt.appointmentType}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(appt.scheduledDate)} · {appt.scheduledWindow}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Approved change orders */}
      {permissionSet?.canViewChangeOrders && changeOrders.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Approved Change Orders
          </h3>
          <div className="space-y-3">
            {changeOrders.map((co) => (
              <div
                key={co.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface-elevated px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {co.changeOrderNumber} — {co.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Approved {formatDate(co.approvedAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  ${(co.approvedAmountCents / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
