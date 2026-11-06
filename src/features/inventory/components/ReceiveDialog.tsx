"use client";

import { PackagePlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { parseDollarsToCents } from "../utils/money";
import { parseQuantity } from "../utils/quantity";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";
import { itemLabel, type StockDialogData } from "./StockDialogTypes";

interface ReceiveDialogProps extends Pick<StockDialogData, "items" | "locations"> {
  defaultLocationId?: string | null;
  defaultItemId?: string | null;
  /** Unit cost is only offered to roles allowed to see/set cost. */
  canSetCost: boolean;
  label?: string;
}

export function ReceiveDialog({ items, locations, defaultLocationId, defaultItemId, canSetCost, label = "Receive" }: ReceiveDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PackagePlus size={16} aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <ReceiveForm
          items={items}
          locations={locations}
          defaultLocationId={defaultLocationId}
          defaultItemId={defaultItemId}
          canSetCost={canSetCost}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ReceiveForm({
  items,
  locations,
  defaultLocationId,
  defaultItemId,
  canSetCost,
  onClose,
}: Omit<ReceiveDialogProps, "label"> & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = parseQuantity(qty);
    if (!itemId || !locationId) return setError("Choose an item and a location.");
    if (quantity === undefined || quantity <= 0) return setError("Enter a quantity greater than 0 (up to 3 decimals).");
    const unitCostCents = canSetCost ? parseDollarsToCents(cost) : null;
    if (unitCostCents === undefined) return setError("Enter unit cost as dollars, like 12.50.");
    const result = await run("/api/inventory/transactions", "POST", {
      kind: "receive",
      itemId,
      locationId,
      qty: quantity,
      ...(canSetCost && unitCostCents !== null ? { unitCostCents } : {}),
      ...(note.trim() ? { reason: note.trim() } : {}),
    });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Receive stock" description="Adds quantity to a location. This appends to the ledger." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Item" htmlFor="receive-item">
          <select id="receive-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className={fieldClass}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{itemLabel(item)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Receive into" htmlFor="receive-location">
          <select id="receive-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fieldClass}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Quantity" htmlFor="receive-qty">
          <input id="receive-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} placeholder="0" />
        </FormField>
        {canSetCost ? (
          <FormField label="Unit cost (optional)" htmlFor="receive-cost" hint="Dollars per unit, recorded on this entry.">
            <input id="receive-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={fieldClass} placeholder="0.00" />
          </FormField>
        ) : null}
        <FormField label="Note (optional)" htmlFor="receive-note">
          <input id="receive-note" value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending || items.length === 0}>{pending ? "Saving…" : "Receive"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
