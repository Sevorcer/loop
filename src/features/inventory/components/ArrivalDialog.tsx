"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { ExpectedArrival } from "../types/arrivals";
import { parseQuantity } from "../utils/quantity";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";
import { itemLabel, type StockItemOption, type StockLocationOption } from "./StockDialogTypes";

interface ArrivalDialogProps {
  items: StockItemOption[];
  locations: StockLocationOption[];
  /** Set to edit an open arrival; omit to add one. */
  arrival?: ExpectedArrival;
}

/** Add or edit an expected arrival. The item and the receiving location are fixed once saved. */
export function ArrivalDialog({ items, locations, arrival }: ArrivalDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {arrival ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Edit
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Expect stock
        </Button>
      )}
      {open ? <ArrivalForm items={items} locations={locations} arrival={arrival} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ArrivalForm({ items, locations, arrival, onClose }: ArrivalDialogProps & { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [itemId, setItemId] = useState(arrival?.itemId ?? items[0]?.id ?? "");
  const [locationId, setLocationId] = useState(arrival?.locationId ?? locations[0]?.id ?? "");
  const [qty, setQty] = useState(arrival ? String(arrival.qty) : "");
  const [etaDate, setEtaDate] = useState(arrival?.etaDate ?? "");
  const [note, setNote] = useState(arrival?.supplierNote ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = parseQuantity(qty);
    if (!arrival && !itemId) return setError("Choose the item that is arriving.");
    if (quantity === undefined || quantity <= 0) return setError("Enter a quantity greater than 0 (up to 3 decimals).");
    if (!etaDate) return setError("Enter the expected date.");
    const result = arrival
      ? await run(`/api/inventory/arrivals/${encodeURIComponent(arrival.id)}`, "PATCH", {
          qty: quantity,
          etaDate,
          supplierNote: note.trim() || null,
        })
      : await run("/api/inventory/arrivals", "POST", {
          itemId,
          ...(locationId ? { locationId } : {}),
          qty: quantity,
          etaDate,
          ...(note.trim() ? { supplierNote: note.trim() } : {}),
        });
    if (result.ok) onClose();
  }

  return (
    <DialogShell
      title={arrival ? "Edit expected arrival" : "Expect stock"}
      description="Jobs short on this item count it as coming once the date is early enough. Nothing is added to stock until you mark it received."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Item" htmlFor="arrival-item">
          <select
            id="arrival-item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className={fieldClass}
            disabled={Boolean(arrival)}
          >
            {arrival ? <option value={arrival.itemId}>{arrival.itemName}</option> : null}
            {arrival
              ? null
              : items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {itemLabel(item)}
                  </option>
                ))}
          </select>
        </FormField>
        <FormField label="Arrives at" htmlFor="arrival-location">
          <select
            id="arrival-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={fieldClass}
            disabled={Boolean(arrival)}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity" htmlFor="arrival-qty">
            <input id="arrival-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} placeholder="0" />
          </FormField>
          <FormField label="Expected date" htmlFor="arrival-eta">
            <input id="arrival-eta" type="date" value={etaDate} onChange={(e) => setEtaDate(e.target.value)} className={fieldClass} />
          </FormField>
        </div>
        <FormField label="Supplier note (optional)" htmlFor="arrival-note" hint="Where it is coming from or an order number.">
          <input id="arrival-note" value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} maxLength={500} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || (!arrival && items.length === 0)}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
