"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileCheck, FileUp, Paperclip, Plus, RotateCcw, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PermitStatus } from "@/services/jobPermits";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Permit {
  id: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  notes: string | null;
  correctionsNotes: string | null;
  documentStorageId: string | null;
}

const STATUS_LABELS: Record<PermitStatus, string> = {
  applied: "Applied",
  intake_scheduled: "Intake Scheduled",
  corrections_needed: "Corrections Needed",
  resubmitted: "Resubmitted",
  waiting_on_city: "Waiting on City",
  issued: "Issued",
};

const STATUS_INTENT: Record<PermitStatus, "info" | "warning" | "success" | "danger" | "neutral"> = {
  applied: "info",
  intake_scheduled: "info",
  corrections_needed: "warning",
  resubmitted: "info",
  waiting_on_city: "warning",
  issued: "success",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobPermitsCardProps {
  jobId: string;
  canEdit: boolean;
}

export function JobPermitsCard({ jobId, canEdit }: JobPermitsCardProps) {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPermitId, setUploadingPermitId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPermitIdRef = useRef<string | null>(null);

  const fetchPermits = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/permits`);
      if (!res.ok) return;
      const json = (await res.json()) as { permits: Permit[] };
      setPermits(json.permits ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchPermits();
  }, [fetchPermits]);

  const activePermits = permits.filter((p: Permit) => !p.voidedAt);
  const voidedPermits = permits.filter((p: Permit) => p.voidedAt);

  const handleVoid = useCallback(
    async (permitId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/permits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permitId, action: "void" }),
      });
      if (res.ok) void fetchPermits();
    },
    [jobId, fetchPermits],
  );

  const handleUnvoid = useCallback(
    async (permitId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/permits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permitId, action: "unvoid" }),
      });
      if (res.ok) void fetchPermits();
    },
    [jobId, fetchPermits],
  );

  const handleDocumentUpload = useCallback(
    (permitId: string) => {
      uploadPermitIdRef.current = permitId;
      fileInputRef.current?.click();
    },
    [],
  );

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const permitId = uploadPermitIdRef.current;
      if (!file || !permitId) return;

      setUploadingPermitId(permitId);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("permitId", permitId);

        const res = await fetch(`/api/jobs/${jobId}/permits/document`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          void fetchPermits();
        }
      } finally {
        setUploadingPermitId(null);
        uploadPermitIdRef.current = null;
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [jobId, fetchPermits],
  );

  if (loading) {
    return (
      <SurfaceCard>
        <div className="flex items-center gap-2 p-4">
          <FileCheck className="h-4 w-4 text-muted" />
          <span className="text-sm text-muted">Loading permits...</span>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-muted" />
            <h3 className="text-sm font-medium text-primary">
              Permits{activePermits.length > 0 ? ` (${activePermits.length})` : ""}
            </h3>
          </div>
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add Permit
            </Button>
          )}
        </div>

        {/* Hidden file input for document upload */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileSelected}
        />

        {activePermits.length === 0 && (
          <p className="text-sm text-muted py-2">No permits recorded.</p>
        )}

        <div className="space-y-2">
          {activePermits.map((permit: Permit) => (
            <div
              key={permit.id}
              className={cn(
                "rounded-lg border border-border p-3",
                "transition-colors hover:bg-surface-elevated/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary truncate">
                      {permit.jurisdiction} — {permit.permitType}
                    </span>
                    <StatusBadge variant={STATUS_INTENT[permit.status as PermitStatus]}>
                      {STATUS_LABELS[permit.status as PermitStatus]}
                    </StatusBadge>
                    {permit.documentStorageId && (
                      <Paperclip className="h-3 w-3 text-muted" title="Document attached" />
                    )}
                  </div>
                  {permit.permitNumber && (
                    <p className="text-xs text-muted">#{permit.permitNumber}</p>
                  )}
                  {permit.notes && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{permit.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && !permit.documentStorageId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted hover:text-primary"
                      onClick={() => handleDocumentUpload(permit.id)}
                      disabled={uploadingPermitId === permit.id}
                      title="Upload permit document"
                    >
                      <FileUp className="h-3 w-3" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted hover:text-danger"
                      onClick={() => void handleVoid(permit.id)}
                      title="Void permit"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {canEdit && voidedPermits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted mb-2">
              Voided ({voidedPermits.length})
            </p>
            <div className="space-y-1">
              {voidedPermits.map((permit: Permit) => (
                <div
                  key={permit.id}
                  className="flex items-center justify-between rounded px-2 py-1 opacity-60"
                >
                  <span className="text-xs text-muted line-through">
                    {permit.jurisdiction} — {permit.permitType}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 gap-1 text-xs"
                    onClick={() => void handleUnvoid(permit.id)}
                    title="Restore permit"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
