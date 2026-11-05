"use client";

/**
 * GcPortalScreen — GC Portal v1 + v2
 *
 * The main builder-facing portal view. Shows job status, progress timeline,
 * permits, inspections, timeline, photos, documents, financials, and
 * change orders. No internal notes, no personal data beyond first names.
 *
 * Fetches data client-side via the public portal API using the share-link token.
 */

import { useEffect, useState } from "react";
import { Calendar, Clock, Users, FileText, Camera, AlertCircle } from "lucide-react";

import type { PortalJobData } from "../types/gcPortal";
import { GcPortalTimeline } from "../components/GcPortalTimeline";
import { GcPortalPhotos } from "../components/GcPortalPhotos";
import { GcPortalDocuments } from "../components/GcPortalDocuments";
import { GcPortalMoney } from "../components/GcPortalMoney";
import { GcPortalSubmitForm } from "../components/GcPortalSubmitForm";
import { GcPortalPermits } from "../components/GcPortalPermits";
import { GcPortalInspections } from "../components/GcPortalInspections";
import { GcPortalProgress } from "../components/GcPortalProgress";
import { GcPortalEstimate } from "../components/GcPortalEstimate";
import { GcPortalBilling } from "../components/GcPortalBilling";
import { GcPortalChangeOrders } from "../components/GcPortalChangeOrders";

interface GcPortalScreenProps {
  token: string;
}

export function GcPortalScreen({ token }: GcPortalScreenProps) {
  const [job, setJob] = useState<PortalJobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobData() {
      try {
        const res = await fetch(`/api/portal/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("This link is invalid or has been revoked.");
          } else {
            setError("Failed to load job data. Please try again later.");
          }
          return;
        }
        const data = await res.json();
        setJob(data.job as PortalJobData);
      } catch {
        setError("Failed to load job data. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }

    loadJobData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">
          {error ?? "Job not found"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If you believe this is an error, please contact the office.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Job Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {job.jobNumber && (
            <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {job.jobNumber}
            </span>
          )}
          <StatusBadge status={job.status} />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          {job.propertyAddress ?? "Job Details"}
        </h1>
        {job.customerName && (
          <p className="text-sm text-muted-foreground">{job.customerName}</p>
        )}
      </div>

      {/* Key Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {job.scheduledDate && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(job.scheduledDate)}
              </p>
            </div>
          </div>
        )}
        {job.completedDate && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(job.completedDate)}
              </p>
            </div>
          </div>
        )}
        {job.crewFirstNames.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Crew</p>
              <p className="text-sm font-medium text-foreground">
                {job.crewFirstNames.join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      {job.progressTimeline && job.progressTimeline.length > 0 && (
        <GcPortalProgress milestones={job.progressTimeline} />
      )}

      {/* Estimate — only shown when portal_money_visible is true */}
      {job.estimate && <GcPortalEstimate estimate={job.estimate} />}

      {/* Billing Snapshot — only shown when portal_money_visible is true */}
      {job.billing && <GcPortalBilling billing={job.billing} />}

      {/* Money Section (legacy) — only shown when portal_money_visible is true */}
      {job.money && <GcPortalMoney money={job.money} />}

      {/* Change Orders */}
      {job.changeOrders && job.changeOrders.length > 0 && (
        <GcPortalChangeOrders changeOrders={job.changeOrders} />
      )}

      {/* Permits */}
      {job.permits && job.permits.length > 0 && (
        <GcPortalPermits permits={job.permits} />
      )}

      {/* Inspections */}
      {job.inspections && job.inspections.length > 0 && (
        <GcPortalInspections inspections={job.inspections} />
      )}

      {/* Timeline */}
      {job.timeline.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
          </div>
          <GcPortalTimeline events={job.timeline} />
        </section>
      )}

      {/* Photos */}
      {job.photos.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Photos</h2>
          </div>
          <GcPortalPhotos photos={job.photos} />
        </section>
      )}

      {/* Documents */}
      {job.documents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Documents</h2>
          </div>
          <GcPortalDocuments documents={job.documents} />
        </section>
      )}

      {/* Issue/Request Submission */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Submit an Issue or Request
        </h2>
        <GcPortalSubmitForm token={token} />
      </section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Scheduled: "text-blue-300 bg-blue-900/40 ring-1 ring-blue-700/40",
    "In Progress": "text-amber-300 bg-amber-900/40 ring-1 ring-amber-700/40",
    "On Hold": "text-orange-300 bg-orange-900/40 ring-1 ring-orange-700/40",
    Completed: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
    Cancelled: "text-red-300 bg-red-900/40 ring-1 ring-red-700/40",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status] ?? "text-slate-300 bg-slate-800/60"}`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
