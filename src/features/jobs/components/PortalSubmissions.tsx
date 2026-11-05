"use client";

/**
 * PortalSubmissions — GC Portal Task 4 + Triage Queue
 *
 * Displays builder-submitted issues/requests on the job page.
 * Office staff can accept or dismiss submissions from the triage queue.
 * Visible to internal staff.
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, MessageSquare, Loader2, X } from "lucide-react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

type SubmissionStatus = "unreviewed" | "accepted" | "dismissed";

interface PortalSubmission {
  id: string;
  name: string;
  company: string;
  contact: string;
  message: string;
  status: SubmissionStatus;
  createdAt: string;
}

interface PortalSubmissionsProps {
  jobId: string;
}

const STATUS_LABELS: Record<SubmissionStatus, { label: string; className: string }> = {
  unreviewed: {
    label: "Unreviewed",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  accepted: {
    label: "Accepted",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  dismissed: {
    label: "Dismissed",
    className: "border-slate-400/30 bg-slate-400/10 text-slate-400",
  },
};

export function PortalSubmissions({ jobId }: PortalSubmissionsProps) {
  const { role } = useCurrentRole();
  const [submissions, setSubmissions] = useState<PortalSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/jobs/${jobId}/portal-submissions`);
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data.submissions as PortalSubmission[]);
        }
      } catch {
        // Silent fail for v1
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  const handleUpdateStatus = useCallback(
    async (submissionId: string, status: SubmissionStatus) => {
      setUpdating(submissionId);
      try {
        await requestJson(`/api/jobs/${jobId}/portal-submissions`, {
          method: "PATCH",
          role,
          body: { submissionId, status },
        });
        setSubmissions((current) =>
          current.map((sub) =>
            sub.id === submissionId ? { ...sub, status } : sub,
          ),
        );
      } catch {
        // Silent fail — the UI stays at the old status
      } finally {
        setUpdating(null);
      }
    },
    [jobId, role],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading submissions...</span>
      </div>
    );
  }

  if (submissions.length === 0) {
    return null;
  }

  const unreviewedCount = submissions.filter((s) => s.status === "unreviewed").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Portal Submissions ({submissions.length})
        </span>
        {unreviewedCount > 0 ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
            {unreviewedCount} to review
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {submissions.map((sub) => {
          const statusInfo = STATUS_LABELS[sub.status] ?? STATUS_LABELS.unreviewed;
          const isUpdating = updating === sub.id;

          return (
            <div
              key={sub.id}
              className="rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{sub.name}</p>
                    {sub.company ? (
                      <span className="text-xs text-muted-foreground">
                        ({sub.company})
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  {sub.contact && (
                    <p className="text-xs text-muted-foreground">{sub.contact}</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(sub.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-sm text-foreground/80">{sub.message}</p>

              {sub.status === "unreviewed" ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(sub.id, "accepted")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(sub.id, "dismissed")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
