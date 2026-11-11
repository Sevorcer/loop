"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export interface PickedUnit {
  serialUnitId: string;
  serialNumber: string;
}

export interface PickableUnitOption {
  id: string;
  serialNumber: string;
}

interface LineUnitPickerProps {
  lineId: string;
  lineName: string;
  /** How many units the line needs (its quantity, rounded up). */
  needed: number;
  picked: PickedUnit[];
  available: PickableUnitOption[];
  /** Picking and releasing are owner, manager and office actions; everyone else sees the picks only. */
  canEdit: boolean;
}

/** Choose the actual units for a serialized material line instead of typing serials. */
export function LineUnitPicker({ lineId, lineName, needed, picked, available, canEdit }: LineUnitPickerProps) {
  const { run, pending, error } = useInventoryMutation();
  const [choice, setChoice] = useState("");
  const remaining = Math.max(0, needed - picked.length);

  async function pick() {
    if (!choice) return;
    const result = await run("/api/inventory/line-serials", "POST", { lineId, serialUnitId: choice });
    if (result.ok) setChoice("");
  }

  return (
    <div className="space-y-2">
      {picked.length > 0 ? (
        <ul className="space-y-1" aria-label={`Units picked for ${lineName}`}>
          {picked.map((unit) => (
            <li key={unit.serialUnitId} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-primary">{unit.serialNumber}</span>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  className="print:hidden"
                  aria-label={`Release ${unit.serialNumber}`}
                  onClick={() => void run(`/api/inventory/line-serials/${encodeURIComponent(unit.serialUnitId)}`, "DELETE")}
                >
                  Release
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No unit picked yet.</p>
      )}

      {canEdit && remaining > 0 ? (
        <div className="flex items-center gap-2 print:hidden">
          <select
            aria-label={`Pick a unit for ${lineName}`}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className={fieldClass}
            disabled={pending || available.length === 0}
          >
            <option value="">{available.length === 0 ? "No units in stock" : `Pick a unit (${remaining} to go)`}</option>
            {available.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.serialNumber}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="secondary" disabled={pending || !choice} onClick={() => void pick()}>
            {pending ? "Saving…" : "Pick"}
          </Button>
        </div>
      ) : null}
      <FormError message={error} />
    </div>
  );
}
