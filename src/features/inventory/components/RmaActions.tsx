"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { RmaAction } from "../types/serials";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export interface RmaLocationOption {
  id: string;
  name: string;
}

interface RmaActionsProps {
  unitId: string;
  serialNumber: string;
  /** The steps open for this unit's status (see rmaActionsFor). */
  actions: readonly RmaAction[];
  /** Active non-quarantine locations a repaired unit can go back to. */
  stockLocations: readonly RmaLocationOption[];
  /** Active quarantine locations, when the org has more than one. */
  quarantineLocations: readonly RmaLocationOption[];
}

const LABELS: Record<RmaAction, string> = {
  quarantine: "Quarantine",
  repair: "Repaired",
  return_to_supplier: "Return to supplier",
  scrap: "Scrap",
};

const DIALOG_COPY: Record<RmaAction, { title: string; description: string; confirm: string }> = {
  quarantine: {
    title: "Send to quarantine",
    description: "The unit leaves its place and is held until it is repaired, returned or scrapped. It can no longer be picked for a job.",
    confirm: "Quarantine",
  },
  repair: {
    title: "Back in stock",
    description: "The unit was repaired. Choose where it goes back to.",
    confirm: "Put back in stock",
  },
  return_to_supplier: {
    title: "Return to supplier",
    description: "The unit leaves stock. This cannot be undone.",
    confirm: "Return to supplier",
  },
  scrap: {
    title: "Scrap unit",
    description: "The unit is written off. This cannot be undone.",
    confirm: "Scrap",
  },
};

/** One RMA step on a unit. The server decides what is allowed; this only offers the open steps. */
export function RmaActions({ unitId, serialNumber, actions, stockLocations, quarantineLocations }: RmaActionsProps) {
  const [open, setOpen] = useState<RmaAction | null>(null);
  if (actions.length === 0) return <span className="text-sm text-muted">Closed</span>;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          size="sm"
          variant={action === "repair" || action === "quarantine" ? "secondary" : "ghost"}
          onClick={() => setOpen(action)}
        >
          {LABELS[action]}
        </Button>
      ))}
      {open ? (
        <RmaDialog
          action={open}
          unitId={unitId}
          serialNumber={serialNumber}
          stockLocations={stockLocations}
          quarantineLocations={quarantineLocations}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function RmaDialog({
  action,
  unitId,
  serialNumber,
  stockLocations,
  quarantineLocations,
  onClose,
}: {
  action: RmaAction;
  unitId: string;
  serialNumber: string;
  stockLocations: readonly RmaLocationOption[];
  quarantineLocations: readonly RmaLocationOption[];
  onClose: () => void;
}) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [note, setNote] = useState("");
  const options = action === "repair" ? stockLocations : action === "quarantine" ? quarantineLocations : [];
  const [locationId, setLocationId] = useState("");
  const copy = DIALOG_COPY[action];
  const needsLocation = action === "repair";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (needsLocation && !locationId) return setError("Choose where the unit goes back to.");
    const result = await run(`/api/inventory/serials/${encodeURIComponent(unitId)}/rma`, "POST", {
      action,
      ...(locationId ? { locationId } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (result.ok) onClose();
  }

  const idBase = `rma-${action}-${unitId}`;
  return (
    <DialogShell title={`${copy.title} · ${serialNumber}`} description={copy.description} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        {options.length > 0 && (needsLocation || options.length > 1) ? (
          <FormField label={needsLocation ? "Back to" : "Quarantine location"} htmlFor={`${idBase}-location`}>
            <select id={`${idBase}-location`} value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fieldClass}>
              <option value="">{needsLocation ? "Choose a location" : "Default quarantine"}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField label="Note (optional)" htmlFor={`${idBase}-note`}>
          <input
            id={`${idBase}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={fieldClass}
            maxLength={300}
            placeholder="What was wrong, the supplier’s RMA number…"
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : copy.confirm}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
