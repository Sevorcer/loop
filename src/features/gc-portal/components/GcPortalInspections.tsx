"use client";

/**
 * GcPortalInspections — GC Portal v2
 *
 * Read-only inspections summary for the builder portal.
 * Shows latest inspection type, date, result, and corrections count.
 */

import { ClipboardCheck } from "lucide-react";

import type { PortalInspection } from "../types/gcPortal";

const TYPE_LABELS: Record<string, string> = {
  rough_in: "Rough-In",
  cover: "Cover",
  final: "Final",
  other: "Other",
};

const RESULT_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  passed: "Passed",
  failed: "Failed",
  partial: "Partial",
  rescheduled_by_city: "Rescheduled by City",
};

interface GcPortalInspectionsProps {
  inspections: PortalInspection[];
}

export function GcPortalInspections({ inspections }: GcPortalInspectionsProps) {
  if (inspections.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Inspections</h2>
      </div>

      <div className="space-y-2">
        {inspections.map((inspection) => (
          <div
            key={inspection.id}
            className="rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {TYPE_LABELS[inspection.inspectionType] ?? inspection.inspectionType}
                </span>
                <ResultBadge result={inspection.result} />
              </div>
              {inspection.scheduledDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(inspection.scheduledDate)}
                </span>
              )}
            </div>
            {(inspection.inspectorName || inspection.correctionsCount > 0) && (
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                {inspection.inspectorName && (
                  <span>Inspector: {inspection.inspectorName}</span>
                )}
                {inspection.correctionsCount > 0 && (
                  <span className="text-amber-400">
                    {inspection.correctionsCount} correction{inspection.correctionsCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultBadge({ result }: { result: string }) {
  const label = RESULT_LABELS[result] ?? result;
  const colorMap: Record<string, string> = {
    passed: "text-emerald-300 bg-emerald-900/40 ring-1 ring-emerald-700/40",
    failed: "text-red-300 bg-red-900/40 ring-1 ring-red-700/40",
    partial: "text-amber-300 bg-amber-900/40 ring-1 ring-amber-700/40",
    scheduled: "text-blue-300 bg-blue-900/40 ring-1 ring-blue-700/40",
    rescheduled_by_city: "text-orange-300 bg-orange-900/40 ring-1 ring-orange-700/40",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        colorMap[result] ?? "text-slate-300 bg-slate-800/60"
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
