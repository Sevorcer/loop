"use client";

import { useState, type FormEvent } from "react";

import { ModalDialog } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { ActionResult } from "../../state/MaterialPlanProvider";
import { formatMaterialQuantity } from "../../utils/jobMaterials";
import { PlanError, PlanField } from "./PlanFormParts";
import { planFieldClass } from "./planStyles";

type Submit<T> = (values: T) => Promise<ActionResult>;

interface DialogProps<T> {
  lineName: string;
  onSubmit: Submit<T>;
  onClose: () => void;
}

function DialogButtons({ pending, onClose, submitLabel, danger }: { pending: boolean; onClose: () => void; submitLabel: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" variant={danger ? "destructive" : "primary"} disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}

/** Shared shell for "type a reason, then confirm" dialogs. */
function useReasonForm<T>(onSubmit: Submit<T>, onClose: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(values: T) {
    setPending(true);
    setError(null);
    const result = await onSubmit(values);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.message ?? "That did not work. Please try again.");
  }
  return { pending, error, run };
}

// -- Change quantity ---------------------------------------------------------

export function AdjustQuantityDialog({
  lineName,
  quantity,
  unit,
  onSubmit,
  onClose,
}: DialogProps<{ quantity: number; reason: string }> & { quantity: number; unit: string }) {
  const { pending, error, run } = useReasonForm(onSubmit, onClose);
  const [draft, setDraft] = useState(String(quantity));
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = Number(draft);
    if (!Number.isFinite(next) || next <= 0) return setLocalError("Quantity must be more than zero.");
    if (next === quantity) return setLocalError("That is the quantity already on the plan.");
    if (reason.trim().length < 3) return setLocalError("Say why it changed (a few words is fine).");
    setLocalError(null);
    void run({ quantity: next, reason: reason.trim() });
  }

  return (
    <ModalDialog title="Change quantity" description={`${lineName} — currently ${formatMaterialQuantity(quantity, unit)}.`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <PlanError message={localError ?? error} />
        <PlanField label={`New quantity (${unit})`} htmlFor="plan-qty">
          <input id="plan-qty" type="number" inputMode="decimal" min={0} step="any" value={draft} onChange={(e) => setDraft(e.target.value)} className={planFieldClass} />
        </PlanField>
        <PlanField label="Why is it changing?" htmlFor="plan-qty-reason" hint="This is kept in the plan history.">
          <input id="plan-qty-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={planFieldClass} maxLength={500} placeholder="For example, longer line run than quoted" />
        </PlanField>
        <DialogButtons pending={pending} onClose={onClose} submitLabel="Save change" />
      </form>
    </ModalDialog>
  );
}

// -- Remove -------------------------------------------------------------------

export function RemoveLineDialog({ lineName, onSubmit, onClose }: DialogProps<{ reason: string }>) {
  const { pending, error, run } = useReasonForm(onSubmit, onClose);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) return setLocalError("Say why this is coming off the plan.");
    setLocalError(null);
    void run({ reason: reason.trim() });
  }

  return (
    <ModalDialog title="Remove from the plan" description={lineName} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <PlanError message={localError ?? error} />
        <PlanField label="Why is it coming off?" htmlFor="plan-remove-reason" hint="The line goes away; the history keeps this reason.">
          <input id="plan-remove-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={planFieldClass} maxLength={500} placeholder="For example, customer declined the add-on" />
        </PlanField>
        <DialogButtons pending={pending} onClose={onClose} submitLabel="Remove line" danger />
      </form>
    </ModalDialog>
  );
}

// -- Not a stocked item -----------------------------------------------------

export function NotStockDialog({ lineName, onSubmit, onClose }: DialogProps<{ reason: string }>) {
  const { pending, error, run } = useReasonForm(onSubmit, onClose);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim().length < 3) return setLocalError("Say why this is not a stocked item.");
    setLocalError(null);
    void run({ reason: reason.trim() });
  }

  return (
    <ModalDialog
      title="Not a stocked item"
      description={`${lineName} stays on the plan but is never pulled from stock.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <PlanError message={localError ?? error} />
        <PlanField label="Why isn’t it stocked?" htmlFor="plan-notstock-reason">
          <input id="plan-notstock-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={planFieldClass} maxLength={500} placeholder="For example, bought at the supply house on the day" />
        </PlanField>
        <DialogButtons pending={pending} onClose={onClose} submitLabel="Save" />
      </form>
    </ModalDialog>
  );
}
