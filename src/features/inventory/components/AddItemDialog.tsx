"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { FlatCategory } from "../utils/catalogView";
import { emptyItemDraft, itemDraftToPayload, type ItemDraft } from "../utils/itemDraft";
import { DialogShell } from "./DialogShell";
import { FormError } from "./FormMessages";
import { ItemFormFields } from "./ItemFormFields";

interface AddItemDialogProps {
  categories: FlatCategory[];
  /** Whether this role may set cost; the cost fields are not rendered otherwise. */
  canSetCost: boolean;
  defaultCategoryId?: string | null;
}

export function AddItemDialog({ categories, canSetCost, defaultCategoryId }: AddItemDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        Add item
      </Button>
      {open ? <AddItemForm categories={categories} canSetCost={canSetCost} defaultCategoryId={defaultCategoryId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AddItemForm({ categories, canSetCost, defaultCategoryId, onClose }: AddItemDialogProps & { onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, setError } = useInventoryMutation();
  const [draft, setDraft] = useState<ItemDraft>(() => ({ ...emptyItemDraft(), categoryId: defaultCategoryId ?? "" }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const built = itemDraftToPayload(draft, { includeCost: canSetCost });
    if (!built.ok) return setError(built.problem);
    const result = await run("/api/inventory/items", "POST", built.payload);
    if (!result.ok) return;
    const created = (result.data as { item?: { id?: string } } | undefined)?.item?.id;
    onClose();
    if (created) router.push(ROUTE_BUILDERS.INVENTORY_ITEM(created));
  }

  return (
    <DialogShell title="Add catalog item" description="One item can be sellable, stockable, or both." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <FormError message={error} />
        <ItemFormFields idPrefix="add-item" draft={draft} setDraft={setDraft} categories={categories} showCost={canSetCost} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create item"}</Button>
        </div>
      </form>
    </DialogShell>
  );
}
