"use client";

import { type FormEvent, useCallback, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PermitFormFields } from "./PermitFormFields";
import {
  permitFormValuesFromEdit,
  type PermitFormValues,
  type PermitStatus,
} from "./permitForm";

export type { PermitStatus };

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

export function PermitEditPanel({
  permit,
  open,
  onClose,
  onSave,
}: PermitEditPanelProps) {
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<PermitFormValues>(() =>
    permitFormValuesFromEdit(permit),
  );

  const patchValues = useCallback((patch: Partial<PermitFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        await onSave(permit.id, permit.jobId, {
          jurisdiction: values.jurisdiction,
          permitType: values.permitType,
          permitNumber: values.permitNumber || null,
          status: values.status,
          appliedAt: values.appliedAt || null,
          intakeAppointmentAt: values.intakeAppointmentAt || null,
          issuedAt: values.issuedAt || null,
          correctionsNotes: values.correctionsNotes || null,
          notes: values.notes || null,
        });
        onClose();
      } finally {
        setSaving(false);
      }
    },
    [permit.id, permit.jobId, values, onSave, onClose],
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl"
        role="dialog"
        aria-label="Edit permit"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">Edit Permit</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex-1 space-y-5 px-6 py-5">
            <PermitFormFields values={values} onChange={patchValues} />
          </div>

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
