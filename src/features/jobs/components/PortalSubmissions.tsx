"use client";

/**
 * PortalSubmissions — GC Portal Task 4
 *
 * Displays builder-submitted issues/requests on the job page.
 * Visible to internal staff.
 */

import { useEffect, useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";

interface PortalSubmission {
  id: string;
  name: string;
  contact: string;
  message: string;
  createdAt: string;
}

interface PortalSubmissionsProps {
  jobId: string;
}

export function PortalSubmissions({ jobId }: PortalSubmissionsProps) {
  const [submissions, setSubmissions] = useState<PortalSubmission[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Portal Submissions ({submissions.length})
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{sub.name}</p>
                {sub.contact && (
                  <p className="text-xs text-muted-foreground">{sub.contact}</p>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {formatDate(sub.createdAt)}
              </time>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{sub.message}</p>
          </div>
        ))}
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
