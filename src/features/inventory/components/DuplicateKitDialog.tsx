"use client";

import { Copy } from "lucide-react";
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

interface DuplicateKitDialogProps {
  kitId: string;
  kitName: string;
}

/** Copies a kit under a new name, which is the quick way to make a size or vent variant. */
export function DuplicateKitDialog({ kitId, kitName }: DuplicateKitDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Duplicate ${kitName}`}>
        <Copy size={14} aria-hidden="true" />
        Duplicate
      </Button>
      {open ? <DuplicateKitForm kitId={kitId} kitName={kitName} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DuplicateKitForm({ kitId, kitName, onClose }: DuplicateKitDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, setError } = useInventoryMutation();
  const [name, setName] = useState(`${kitName} (copy)`);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = validateKitName(name);
    if (!checked.ok) return setError(checked.message);
    const result = await run("/api/inventory/kits", "POST", { name: checked.value, copyFromId: kitId });
    if (!result.ok) return;
    const id = (result.data as { kit?: { id?: string } } | undefined)?.kit?.id;
    onClose();
    if (id) router.push(ROUTE_BUILDERS.INVENTORY_KIT(id));
  }

  return (
    <DialogShell title={`Duplicate ${kitName}`} description="The copy starts with the same items and quantities." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError message={error} />
        <FormField label="Name for the copy" htmlFor="kit-copy-name">
          <input id="kit-copy-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} maxLength={120} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Copying…" : "Duplicate"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
