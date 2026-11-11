"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { checkSerialInput } from "../utils/serialRules";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface SerialReviewActionsProps {
  unitId: string;
  serialNumber: string;
  /** Correct and remove edit the system's serial list, which needs that permission as well. */
  canEditSystem: boolean;
}

/** Keep, correct or remove one flagged serial. The office decides; nothing is guessed. */
export function SerialReviewActions({ unitId, serialNumber, canEditSystem }: SerialReviewActionsProps) {
  const { run, pending, error, clearError } = useInventoryMutation();
  const [mode, setMode] = useState<"correct" | "remove" | null>(null);

  const url = `/api/inventory/serials/${encodeURIComponent(unitId)}`;

  function close() {
    setMode(null);
    clearError();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void run(url, "PATCH", { action: "keep" })}>
          {pending && mode === null ? "Saving…" : "Keep"}
        </Button>
        {canEditSystem ? (
          <>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setMode("correct")}>
              Correct
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setMode("remove")}>
              Remove
            </Button>
          </>
        ) : null}
      </div>
      {mode === null ? <FormError message={error} /> : null}
      {mode === "correct" ? <CorrectForm url={url} serialNumber={serialNumber} onClose={close} /> : null}
      {mode === "remove" ? <RemoveForm url={url} serialNumber={serialNumber} onClose={close} /> : null}
    </div>
  );
}

function CorrectForm({ url, serialNumber, onClose }: { url: string; serialNumber: string; onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [value, setValue] = useState(serialNumber);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = checkSerialInput(value);
    if (!checked.ok) return setError(checked.message);
    const result = await run(url, "PATCH", { action: "correct", serialNumber: checked.serial });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Correct serial" description="Enter what is printed on the nameplate. The system’s serial is updated to match." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Serial number" htmlFor="serial-correct">
          <input id="serial-correct" value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass} maxLength={64} spellCheck={false} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save serial"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}

function RemoveForm({ url, serialNumber, onClose }: { url: string; serialNumber: string; onClose: () => void }) {
  const { run, pending, error } = useInventoryMutation();

  async function confirm() {
    const result = await run(url, "PATCH", { action: "remove" });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Remove serial" description={`Takes ${serialNumber} off this system. Use this when the serial was typed against the wrong system.`} onClose={onClose}>
      <div className="space-y-4">
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="button" onClick={() => void confirm()} disabled={pending}>{pending ? "Removing…" : "Remove from system"}</Button>
        </div>
      </div>
    </DialogShell>
  );
}
