"use client";

import { Undo2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface ReverseDialogProps {
  transactionId: string;
  /** Human summary, e.g. "Received +4 of 20A breaker at Main warehouse". */
  summary: string;
}

export function ReverseDialog({ transactionId, summary }: ReverseDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Reverse: ${summary}`}>
        <Undo2 size={14} aria-hidden="true" />
        Reverse
      </Button>
      {open ? <ReverseForm transactionId={transactionId} summary={summary} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReverseForm({ transactionId, summary, onClose }: ReverseDialogProps & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return setError("A reason is required to reverse an entry.");
    const result = await run("/api/inventory/transactions", "POST", {
      kind: "reverse",
      transactionId,
      reason: reason.trim(),
    });
    if (result.ok) onClose();
  }

  return (
    <DialogShell
      title="Reverse entry"
      description="Posts an opposite entry and keeps the original in history. Paired transfers are reversed together. This can leave on-hand negative, which is allowed."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-atlas-md bg-surface-elevated px-3 py-2 text-sm text-primary">{summary}</p>
        <FormError message={error} />
        <FormField label="Reason (required)" htmlFor="reverse-reason">
          <input id="reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Reversing…" : "Reverse entry"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
