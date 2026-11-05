"use client";

import { ClipboardCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { parseQuantity } from "../utils/quantity";
import { lookupOnHand, negativeOnHandWarning, projectedOnHand } from "../utils/stockView";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError, FormWarning } from "./FormMessages";
import { fieldClass } from "./formStyles";
import { itemLabel, type StockDialogData } from "./StockDialogTypes";

interface AdjustCountDialogProps extends StockDialogData {
  defaultLocationId?: string | null;
  defaultItemId?: string | null;
  label?: string;
}

export function AdjustCountDialog({ label = "Adjust / Count", ...rest }: AdjustCountDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <ClipboardCheck size={16} aria-hidden="true" />
        {label}
      </Button>
      {open ? <AdjustCountForm {...rest} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AdjustCountForm({
  items,
  locations,
  stock,
  defaultLocationId,
  defaultItemId,
  onClose,
}: Omit<AdjustCountDialogProps, "label"> & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [mode, setMode] = useState<"count" | "adjust">("count");
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [noChange, setNoChange] = useState(false);

  const current = lookupOnHand(stock, itemId, locationId);
  const parsed = parseQuantity(value);
  const projected = parsed === undefined ? undefined : mode === "adjust" ? projectedOnHand(current, parsed) : parsed;
  const itemName = items.find((item) => item.id === itemId)?.name;
  const locationName = locations.find((location) => location.id === locationId)?.label;
  const warning = projected === undefined ? null : negativeOnHandWarning({ itemName, locationName, projected });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNoChange(false);
    if (!itemId || !locationId) return setError("Choose an item and a location.");
    if (parsed === undefined) return setError(mode === "adjust" ? "Enter the change as a number, like -2 or 5." : "Enter the counted quantity.");
    if (mode === "adjust") {
      if (parsed === 0) return setError("An adjustment cannot be 0.");
      if (!reason.trim()) return setError("A reason is required for an adjustment.");
    } else if (parsed < 0) {
      return setError("A count cannot be negative.");
    }
    const result = await run(
      "/api/inventory/transactions",
      "POST",
      mode === "adjust"
        ? { kind: "adjust", itemId, locationId, qtyDelta: parsed, reason: reason.trim() }
        : { kind: "count", itemId, locationId, countedQty: parsed, ...(reason.trim() ? { reason: reason.trim() } : {}) },
    );
    if (!result.ok) return;
    if ((result.data as { noChange?: boolean } | undefined)?.noChange) {
      setNoChange(true);
      return;
    }
    onClose();
  }

  return (
    <DialogShell
      title="Adjust or count"
      description="Corrections are ledger entries; nothing is edited in place. On-hand may go negative and will be flagged."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        {noChange ? <p role="status" className="status-info rounded-atlas-md px-3 py-2 text-sm">Count matches on-hand. Nothing was posted.</p> : null}
        <fieldset className="flex gap-4">
          <legend className="sr-only">Type</legend>
          {(["count", "adjust"] as const).map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2 text-sm text-primary sm:min-h-0">
              <input type="radio" name="adjust-mode" checked={mode === option} onChange={() => setMode(option)} />
              {option === "count" ? "Physical count" : "Adjustment"}
            </label>
          ))}
        </fieldset>
        <FormField label="Item" htmlFor="adjust-item">
          <select id="adjust-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className={fieldClass}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{itemLabel(item)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Location" htmlFor="adjust-location">
          <select id="adjust-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fieldClass}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </FormField>
        <p className="text-sm text-muted">Currently on hand: <span className="font-medium text-primary">{current}</span></p>
        <FormField
          label={mode === "count" ? "Counted quantity" : "Change (+ or -)"}
          htmlFor="adjust-value"
          hint={mode === "count" ? "The ledger records the difference from on-hand." : undefined}
        >
          <input id="adjust-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass} placeholder={mode === "count" ? "0" : "-2"} />
        </FormField>
        <FormField label={mode === "adjust" ? "Reason (required)" : "Note (optional)"} htmlFor="adjust-reason">
          <input id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <FormWarning message={warning} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending || items.length === 0}>{pending ? "Saving…" : mode === "count" ? "Post count" : "Post adjustment"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
