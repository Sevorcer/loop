"use client";

import { CappedSelect } from "./CappedSelect";
import {
  PERMIT_STATUS_OPTIONS,
  type PermitFormValues,
  type PermitStatus,
} from "./permitForm";

export const permitFieldClass =
  "w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function PermitFormFields({
  values,
  onChange,
}: {
  values: PermitFormValues;
  onChange: (patch: Partial<PermitFormValues>) => void;
}) {
  return (
    <>
      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Jurisdiction
        </label>
        <input
          type="text"
          value={values.jurisdiction}
          onChange={(e) => onChange({ jurisdiction: e.target.value })}
          className={permitFieldClass}
          placeholder="e.g. City of Seattle"
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Permit Type
        </label>
        <input
          type="text"
          value={values.permitType}
          onChange={(e) => onChange({ permitType: e.target.value })}
          className={permitFieldClass}
          placeholder="e.g. Mechanical"
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Permit Number
        </label>
        <input
          type="text"
          value={values.permitNumber}
          onChange={(e) => onChange({ permitNumber: e.target.value })}
          className={permitFieldClass}
          placeholder="e.g. MEC-2024-001234"
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Status
        </label>
        <CappedSelect
          value={values.status}
          options={PERMIT_STATUS_OPTIONS}
          onChange={(v) => onChange({ status: v as PermitStatus })}
          ariaLabel="Status"
          triggerClassName={permitFieldClass}
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Applied At
        </label>
        <input
          type="date"
          value={values.appliedAt}
          onChange={(e) => onChange({ appliedAt: e.target.value })}
          className={permitFieldClass}
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Intake Appointment At
        </label>
        <input
          type="date"
          value={values.intakeAppointmentAt}
          onChange={(e) => onChange({ intakeAppointmentAt: e.target.value })}
          className={permitFieldClass}
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Issued At
        </label>
        <input
          type="date"
          value={values.issuedAt}
          onChange={(e) => onChange({ issuedAt: e.target.value })}
          className={permitFieldClass}
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Corrections Notes
        </label>
        <textarea
          value={values.correctionsNotes}
          onChange={(e) => onChange({ correctionsNotes: e.target.value })}
          rows={3}
          className={`${permitFieldClass} resize-none`}
          placeholder="Notes about corrections needed..."
        />
      </fieldset>

      <fieldset>
        <label className="mb-1.5 block text-xs font-medium text-muted">
          Notes
        </label>
        <textarea
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          className={`${permitFieldClass} resize-none`}
          placeholder="General notes..."
        />
      </fieldset>
    </>
  );
}
