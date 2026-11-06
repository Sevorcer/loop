"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { ARRIVAL_BUFFER_DAYS_MAX, READINESS_LEAD_DAYS_MAX, type InventorySettings } from "../types/kits";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface RulesFormProps {
  settings: InventorySettings;
  canEdit: boolean;
}

function toWholeNumber(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  return Number(value.trim());
}

/** Lead window and arrival buffer. Read-only unless the viewer may edit (owner). */
export function RulesForm({ settings, canEdit }: RulesFormProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [lead, setLead] = useState(String(settings.readinessLeadDays));
  const [buffer, setBuffer] = useState(String(settings.arrivalBufferDays));
  const [saved, setSaved] = useState(false);

  const dirty = lead !== String(settings.readinessLeadDays) || buffer !== String(settings.arrivalBufferDays);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const leadDays = toWholeNumber(lead);
    const bufferDays = toWholeNumber(buffer);
    if (leadDays === null || leadDays > READINESS_LEAD_DAYS_MAX) {
      return setError(`Lead days must be a whole number from 0 to ${READINESS_LEAD_DAYS_MAX}.`);
    }
    if (bufferDays === null || bufferDays > ARRIVAL_BUFFER_DAYS_MAX) {
      return setError(`Arrival buffer must be a whole number from 0 to ${ARRIVAL_BUFFER_DAYS_MAX}.`);
    }
    const result = await run("/api/inventory/settings", "PATCH", {
      readinessLeadDays: leadDays,
      arrivalBufferDays: bufferDays,
    });
    if (result.ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Order-lead window (days)"
          htmlFor="rules-lead"
          hint="A missing part that has not been ordered becomes “at risk” when the job is this close."
        >
          <input
            id="rules-lead"
            inputMode="numeric"
            value={lead}
            onChange={(e) => {
              setLead(e.target.value);
              setSaved(false);
            }}
            disabled={!canEdit || pending}
            className={fieldClass}
          />
        </FormField>
        <FormField
          label="Arrival buffer (days)"
          htmlFor="rules-buffer"
          hint="An incoming order only counts if it is due at least this many days before the job."
        >
          <input
            id="rules-buffer"
            inputMode="numeric"
            value={buffer}
            onChange={(e) => {
              setBuffer(e.target.value);
              setSaved(false);
            }}
            disabled={!canEdit || pending}
            className={fieldClass}
          />
        </FormField>
      </div>
      {settings.isDefault ? <p className="text-xs text-muted">These are the built-in defaults. Saving stores your own.</p> : null}
      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {saved ? <span role="status" className="text-sm text-muted">Saved</span> : null}
          <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the owner can change these.</p>
      )}
    </form>
  );
}
