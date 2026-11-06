"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export function LocationDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        Add warehouse or quarantine
      </Button>
      {open ? <LocationForm onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LocationForm({ onClose }: { onClose: () => void }) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [type, setType] = useState<"warehouse" | "quarantine">("warehouse");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the location a name.");
    const result = await run("/api/inventory/locations", "POST", { type, name: name.trim(), address: address.trim() || null });
    if (result.ok) onClose();
  }

  return (
    <DialogShell title="Add location" description="Vans are added with their vehicle, not here." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Type" htmlFor="location-type">
          <select id="location-type" value={type} onChange={(e) => setType(e.target.value as "warehouse" | "quarantine")} className={fieldClass}>
            <option value="warehouse">Warehouse</option>
            <option value="quarantine">Quarantine / RMA</option>
          </select>
        </FormField>
        <FormField label="Name" htmlFor="location-name">
          <input id="location-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} maxLength={100} />
        </FormField>
        <FormField label="Address (optional)" htmlFor="location-address">
          <input id="location-address" value={address} onChange={(e) => setAddress(e.target.value)} className={fieldClass} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add location"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
