"use client";

import { type FormEvent, useCallback, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CappedSelect } from "./CappedSelect";
type PermitStatus =
  | "applied"
  | "intake_scheduled"
  | "corrections_needed"
  | "resubmitted"
  | "waiting_on_city"
  | "issued";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermitEditData {
  id: string;
  jobId: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
}

interface PermitEditPanelProps {
  permit: PermitEditData;
  open: boolean;
  onClose: () => void;
  onSave: (
    permitId: string,
    jobId: string,
    fields: Record<string, unknown>,
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: PermitStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "intake_scheduled", label: "Intake Scheduled" },
  { value: "corrections_needed", label: "Corrections Needed" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "waiting_on_city", label: "Waiting on City" },
  { value: "issued", label: "Issued" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    return iso.slice(0, 10);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermitEditPanel({
  permit,
  open,
  onClose,
  onSave,
}: PermitEditPanelProps) {
  const [saving, setSaving] = useState(false);

  const [jurisdiction, setJurisdiction] = useState(permit.jurisdiction);
  const [permitType, setPermitType] = useState(permit.permitType);
  const [permitNumber, setPermitNumber] = useState(permit.permitNumber ?? "");
  const [status, setStatus] = useState<PermitStatus>(permit.status);
  const [appliedAt, setAppliedAt] = useState(
    toDateInputValue(permit.appliedAt),
  );
  const [intakeAppointmentAt, setIntakeAppointmentAt] = useState(
    toDateInputValue(permit.intakeAppointmentAt),
  );
  const [issuedAt, setIssuedAt] = useState(
    toDateInputValue(permit.issuedAt),
  );
  const [correctionsNotes, setCorrectionsNotes] = useState(
    permit.correctionsNotes ?? "",
  );
  const [notes, setNotes] = useState(permit.notes ?? "");

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        await onSave(permit.id, permit.jobId, {
          jurisdiction,
          permitType,
          permitNumber: permitNumber || null,
          status,
          appliedAt: appliedAt || null,
          intakeAppointmentAt: intakeAppointmentAt || null,
          issuedAt: issuedAt || null,
          correctionsNotes: correctionsNotes || null,
          notes: notes || null,
        });
        onClose();
      } finally {
        setSaving(false);
      }
    },
    [
      permit.id,
      permit.jobId,
      jurisdiction,
      permitType,
      permitNumber,
      status,
      appliedAt,
      intakeAppointmentAt,
      issuedAt,
      correctionsNotes,
      notes,
      onSave,
      onClose,
    ],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
        role="dialog"
        aria-label="Edit permit"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">Edit Permit</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex-1 space-y-5 px-6 py-5">
            {/* Jurisdiction */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Jurisdiction
              </label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. City of Seattle"
              />
            </fieldset>

            {/* Permit Type */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Permit Type
              </label>
              <input
                type="text"
                value={permitType}
                onChange={(e) => setPermitType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. Mechanical"
              />
            </fieldset>

            {/* Permit Number */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Permit Number
              </label>
              <input
                type="text"
                value={permitNumber}
                onChange={(e) => setPermitNumber(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. MEC-2024-001234"
              />
            </fieldset>

            {/* Status */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Status
              </label>
              <CappedSelect
                value={status}
                options={STATUS_OPTIONS}
                onChange={(v) => setStatus(v as PermitStatus)}
                ariaLabel="Status"
                triggerClassName="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </fieldset>

            {/* Applied At */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Applied At
              </label>
              <input
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </fieldset>

            {/* Intake Appointment At */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Intake Appointment At
              </label>
              <input
                type="date"
                value={intakeAppointmentAt}
                onChange={(e) => setIntakeAppointmentAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </fieldset>

            {/* Issued At */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Issued At
              </label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </fieldset>

            {/* Corrections Notes */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Corrections Notes
              </label>
              <textarea
                value={correctionsNotes}
                onChange={(e) => setCorrectionsNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                placeholder="Notes about corrections needed..."
              />
            </fieldset>

            {/* Notes */}
            <fieldset>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                placeholder="General notes..."
              />
            </fieldset>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
