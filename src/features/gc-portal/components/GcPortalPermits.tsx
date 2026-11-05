"use client";

/**
 * GcPortalPermits — GC Portal v2
 *
 * Read-only permits list for the builder portal.
 * Shows permit jurisdiction, type, status, and download link for documents.
 */

import { Download, FileCheck } from "lucide-react";

import type { PortalPermit } from "../types/gcPortal";

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  intake_scheduled: "Intake Scheduled",
  corrections_needed: "Corrections Needed",
  resubmitted: "Resubmitted",
  waiting_on_city: "Waiting on City",
  issued: "Issued",
};

interface GcPortalPermitsProps {
  permits: PortalPermit[];
}

export function GcPortalPermits({ permits }: GcPortalPermitsProps) {
  if (permits.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Permits</h2>
      </div>

      <div className="space-y-2">
        {permits.map((permit) => (
          <div
            key={permit.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  {permit.jurisdiction} — {permit.permitType}
                </span>
                <PermitStatusBadge status={permit.status} />
              </div>
              {permit.permitNumber && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  #{permit.permitNumber}
                </p>
              )}
              {permit.issuedAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Issued {formatDate(permit.issuedAt)}
                </p>
              )}
            </div>
            {permit.documentUrl && (
              <a
                href={permit.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-elevated"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PermitStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const colorMap: Record<string, string> = {
    issued: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
    corrections_needed: "text-amber-300 bg-amber-900/40 ring-1 ring-amber-700/40",
    waiting_on_city: "text-amber-300 bg-amber-900/40 ring-1 ring-amber-700/40",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colorMap[status] ?? "text-blue-300 bg-blue-900/40 ring-1 ring-blue-700/40"
      }`}
    >
      {label}
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
