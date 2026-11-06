"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { validateKitName } from "../utils/kitRules";
import { DialogShell } from "./DialogShell";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

/** Creates an empty kit, then opens its editor to add items. */
export function NewKitDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        New kit
      </Button>
      {open ? <NewKitForm onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NewKitForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, setError } = useInventoryMutation();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = validateKitName(name);
    if (!checked.ok) return setError(checked.message);
    const result = await run("/api/inventory/kits", "POST", {
      name: checked.value,
      category: category.trim() || null,
      description: description.trim() || null,
    });
    if (!result.ok) return;
    const id = (result.data as { kit?: { id?: string } } | undefined)?.kit?.id;
    onClose();
    if (id) router.push(ROUTE_BUILDERS.INVENTORY_KIT(id));
  }

  return (
    <DialogShell title="New kit" description="You will add the items on the next screen." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Name" htmlFor="kit-name" hint="For example, Gas furnace swap (condensing).">
          <input id="kit-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} maxLength={120} />
        </FormField>
        <FormField label="Category (optional)" htmlFor="kit-category" hint="A short label such as Furnace, Heat pump or Mini-split.">
          <input id="kit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass} maxLength={60} />
        </FormField>
        <FormField label="Description (optional)" htmlFor="kit-description">
          <textarea id="kit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={fieldClass} maxLength={1000} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create kit"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
