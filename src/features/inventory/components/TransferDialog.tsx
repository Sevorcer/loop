"use client";

import { ArrowLeftRight } from "lucide-react";
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

interface TransferDialogProps extends StockDialogData {
  defaultFromLocationId?: string | null;
  defaultItemId?: string | null;
  label?: string;
}

export function TransferDialog({ label = "Transfer", ...rest }: TransferDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <ArrowLeftRight size={16} aria-hidden="true" />
        {label}
      </Button>
      {open ? <TransferForm {...rest} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TransferForm({
  items,
  locations,
  stock,
  defaultFromLocationId,
  defaultItemId,
  onClose,
}: Omit<TransferDialogProps, "label"> & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [fromId, setFromId] = useState(defaultFromLocationId ?? locations[0]?.id ?? "");
  const [toId, setToId] = useState(locations.find((location) => location.id !== (defaultFromLocationId ?? locations[0]?.id))?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  const quantity = parseQuantity(qty);
  const fromOnHand = lookupOnHand(stock, itemId, fromId);
  const warning =
    quantity === undefined || quantity <= 0
      ? null
      : negativeOnHandWarning({
          itemName: items.find((item) => item.id === itemId)?.name,
          locationName: locations.find((location) => location.id === fromId)?.label,
          projected: projectedOnHand(fromOnHand, -quantity),
        });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!itemId || !fromId || !toId) return setError("Choose an item, a source and a destination.");
    if (fromId === toId) return setError("Transfer needs two different locations.");
    if (quantity === undefined || quantity <= 0) return setError("Enter a quantity greater than 0 (up to 3 decimals).");
    const result = await run("/api/inventory/transactions", "POST", {
      kind: "transfer",
      itemId,
      fromLocationId: fromId,
      toLocationId: toId,
      qty: quantity,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Transfer stock" description="Moves quantity between two locations as a paired out/in entry." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Item" htmlFor="transfer-item">
          <select id="transfer-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className={fieldClass}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{itemLabel(item)}</option>
            ))}
          </select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="From" htmlFor="transfer-from" hint={`On hand: ${fromOnHand}`}>
            <select id="transfer-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className={fieldClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="To" htmlFor="transfer-to">
            <select id="transfer-to" value={toId} onChange={(e) => setToId(e.target.value)} className={fieldClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Quantity" htmlFor="transfer-qty">
          <input id="transfer-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} placeholder="0" />
        </FormField>
        <FormField label="Note (optional)" htmlFor="transfer-note">
          <input id="transfer-note" value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <FormWarning message={warning} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending || items.length === 0}>{pending ? "Saving…" : "Transfer"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
