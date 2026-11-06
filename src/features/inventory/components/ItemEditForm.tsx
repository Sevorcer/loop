"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { CatalogItemWithCost } from "../types/catalog";
import type { FlatCategory } from "../utils/catalogView";
import { draftFromItem, itemDraftToPayload, type ItemDraft } from "../utils/itemDraft";
import { FormError } from "./FormMessages";
import { ItemFormFields } from "./ItemFormFields";

interface ItemEditFormProps {
  item: CatalogItemWithCost;
  categories: FlatCategory[];
  /** Cost fields exist only when the server attached cost for this role. */
  showCost: boolean;
  canEditCost: boolean;
  canEdit: boolean;
}

export function ItemEditForm({ item, categories, showCost, canEditCost, canEdit }: ItemEditFormProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [draft, setDraft] = useState<ItemDraft>(() => draftFromItem(item));
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const built = itemDraftToPayload(draft, { includeCost: showCost && canEditCost });
    if (!built.ok) return setError(built.problem);
    const result = await run(`/api/inventory/items/${item.id}`, "PATCH", built.payload);
    if (result.ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      {saved ? <p role="status" className="status-success rounded-atlas-md px-3 py-2 text-sm">Saved.</p> : null}
      <fieldset disabled={!canEdit || pending} className="min-w-0 border-0 p-0">
        <ItemFormFields idPrefix="edit-item" draft={draft} setDraft={setDraft} categories={categories} showCost={showCost} showActive />
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Your role can view this item but not change it.</p>
      )}
    </form>
  );
}
