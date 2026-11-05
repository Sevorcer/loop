"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Plus, XCircle } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InspectionResult, InspectionType, InspectionBookedBy } from "@/services/jobInspections";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Inspection {
  id: string;
  inspectionType: InspectionType;
  scheduledDate: string | null;
  scheduledWindow: string | null;
  bookedBy: InspectionBookedBy;
  inspectorName: string | null;
  result: InspectionResult;
  resultDate: string | null;
  rescheduledDate: string | null;
  parentInspectionId: string | null;
  notes: string | null;
}

interface Correction {
  id: string;
  description: string;
  isComplete: boolean;
}

const TYPE_LABELS: Record<InspectionType, string> = {
  rough_in: "Rough-In",
  cover: "Cover",
  final: "Final",
  other: "Other",
};

const RESULT_LABELS: Record<InspectionResult, string> = {
  scheduled: "Scheduled",
  passed: "Passed",
  failed: "Failed",
  partial: "Partial",
  rescheduled_by_city: "Rescheduled by City",
};

const RESULT_INTENT: Record<InspectionResult, "info" | "success" | "danger" | "warning" | "neutral"> = {
  scheduled: "info",
  passed: "success",
  failed: "danger",
  partial: "warning",
  rescheduled_by_city: "warning",
};

const BOOKED_BY_LABELS: Record<InspectionBookedBy, string> = {
  office: "Office",
  gc_or_super: "GC / Super",
  customer: "Customer",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobInspectionsCardProps {
  jobId: string;
  canEdit: boolean;
}

export function JobInspectionsCard({ jobId, canEdit }: JobInspectionsCardProps) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [corrections, setCorrections] = useState<Record<string, Correction[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchInspections = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/inspections`);
      if (!res.ok) return;
      const json = (await res.json()) as { inspections: Inspection[] };
      setInspections(() => json.inspections ?? []);
    } finally {
      setLoading(() => false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchInspections();
  }, [fetchInspections]);

  const fetchCorrections = useCallback(
    async (inspectionId: string) => {
      const res = await fetch(
        `/api/jobs/${jobId}/inspections/${inspectionId}/corrections`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { corrections: Correction[] };
      setCorrections((prev) => ({ ...prev, [inspectionId]: json.corrections ?? [] }));
    },
    [jobId],
  );

  const handleToggleCorrection = useCallback(
    async (inspectionId: string, correctionId: string, isComplete: boolean) => {
      const res = await fetch(
        `/api/jobs/${jobId}/inspections/${inspectionId}/corrections`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correctionId, isComplete }),
        },
      );
      if (res.ok) void fetchCorrections(inspectionId);
    },
    [jobId, fetchCorrections],
  );

  // Track which correction IDs have been fetched via a ref to avoid reading
  // corrections state inside useEffect (which would re-trigger the effect).
  const fetchedCorrectionIdsRef = useRef<Set<string>>(new Set());

  // Load corrections for failed/partial inspections
  useEffect(() => {
    const needCorrections = inspections.filter(
      (i) => i.result === "failed" || i.result === "partial",
    );
    for (const insp of needCorrections) {
      if (!fetchedCorrectionIdsRef.current.has(insp.id)) {
        fetchedCorrectionIdsRef.current.add(insp.id);
        void fetchCorrections(insp.id);
      }
    }
  }, [inspections, fetchCorrections]);

  if (loading) {
    return (
      <SurfaceCard>
        <div className="flex items-center gap-2 p-4">
          <ClipboardCheck className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">Loading inspections…</span>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted" />
            <h3 className="text-sm font-medium text-primary">
              Inspections{inspections.length > 0 ? ` (${inspections.length})` : ""}
            </h3>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Schedule
            </Button>
          )}
        </div>

        {inspections.length === 0 && (
          <p className="text-sm text-muted py-2">No inspections scheduled.</p>
        )}

        <div className="space-y-2">
          {inspections.map((insp) => {
            const inspCorrections = corrections[insp.id] ?? [];
            const isReInspection = !!insp.parentInspectionId;

            return (
              <div
                key={insp.id}
                className={cn(
                  "rounded-lg border border-border p-3",
                  "transition-colors hover:bg-surface-elevated/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-primary">
                        {TYPE_LABELS[insp.inspectionType]}
                        {isReInspection ? " (Re-inspection)" : ""}
                      </span>
                      <StatusBadge variant={RESULT_INTENT[insp.result]}>
                        {RESULT_LABELS[insp.result]}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      {insp.scheduledDate && <span>{insp.scheduledDate}</span>}
                      {insp.scheduledWindow && <span>{insp.scheduledWindow}</span>}
                      <span>Booked by {BOOKED_BY_LABELS[insp.bookedBy]}</span>
                    </div>
                    {insp.inspectorName && (
                      <p className="text-xs text-muted mt-0.5">
                        Inspector: {insp.inspectorName}
                      </p>
                    )}
                    {insp.result === "rescheduled_by_city" && insp.rescheduledDate && (
                      <p className="text-xs text-warning mt-1">
                        Rescheduled to: {insp.rescheduledDate}
                      </p>
                    )}
                    {insp.notes && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{insp.notes}</p>
                    )}
                  </div>
                </div>

                {/* Corrections checklist for failed/partial inspections */}
                {(insp.result === "failed" || insp.result === "partial") &&
                  inspCorrections.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-muted mb-1">Corrections</p>
                      <ul className="space-y-1">
                        {inspCorrections.map((correction) => (
                          <li
                            key={correction.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleCorrection(
                                  insp.id,
                                  correction.id,
                                  !correction.isComplete,
                                )
                              }
                              className="flex-shrink-0"
                              disabled={!canEdit}
                            >
                              {correction.isComplete ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-muted" />
                              )}
                            </button>
                            <span
                              className={cn(
                                correction.isComplete && "line-through text-muted",
                              )}
                            >
                              {correction.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}
