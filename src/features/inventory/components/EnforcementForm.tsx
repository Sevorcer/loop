"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { CloseoutEnforcement } from "../types/kits";
import { FormError } from "./FormMessages";

interface EnforcementOption {
  value: CloseoutEnforcement;
  label: string;
  text: string;
}

interface EnforcementFormProps {
  current: CloseoutEnforcement;
  options: EnforcementOption[];
  canEdit: boolean;
}

/** The closeout stage. Owner-only: moving it up is a deliberate choice, saved on its own. */
export function EnforcementForm({ current, options, canEdit }: EnforcementFormProps) {
  const { run, pending, error } = useInventoryMutation();
  const [selected, setSelected] = useState<CloseoutEnforcement>(current);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const result = await run("/api/inventory/settings", "PATCH", { closeoutEnforcement: selected });
    if (result.ok) setSaved(true);
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <fieldset className="space-y-2" disabled={!canEdit || pending}>
        <legend className="sr-only">Closeout stage</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-atlas-md p-3 transition-colors hover:bg-surface-elevated has-[:checked]:bg-surface-elevated"
          >
            <input
              type="radio"
              name="closeout-stage"
              value={option.value}
              checked={selected === option.value}
              onChange={() => {
                setSelected(option.value);
                setSaved(false);
              }}
              className="mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-medium text-primary">{option.label}</span>
              <span className="block text-sm text-muted">{option.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {saved ? <span role="status" className="text-sm text-muted">Saved</span> : null}
          <Button type="button" disabled={pending || selected === current} onClick={() => void save()}>
            {pending ? "Saving…" : "Save stage"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only the owner can change this.</p>
      )}
    </div>
  );
}
