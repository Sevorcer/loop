"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { CatalogPriceTier } from "../types/catalog";
import { tierDraftsFromTiers, tiersToPayload, type TierDraft } from "../utils/itemDraft";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface PriceTiersEditorProps {
  itemId: string;
  tiers: CatalogPriceTier[];
  canEdit: boolean;
  /** Only owners may remove a saved tier (DELETE is owner-only). */
  canRemoveSaved: boolean;
}

let draftCounter = 0;

export function PriceTiersEditor({ itemId, tiers, canEdit, canRemoveSaved }: PriceTiersEditorProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [rows, setRows] = useState<TierDraft[]>(() => tierDraftsFromTiers(tiers));
  const savedIds = new Set(tiers.map((tier) => tier.id));
  const [saved, setSaved] = useState(false);

  const update = (key: string, patch: Partial<TierDraft>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  async function remove(row: TierDraft) {
    if (savedIds.has(row.key)) {
      const result = await run(`/api/inventory/items/${itemId}/tiers/${row.key}`, "DELETE");
      if (!result.ok) return;
    }
    setRows((current) => current.filter((candidate) => candidate.key !== row.key));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const built = tiersToPayload(rows);
    if (!built.ok) return setError(built.problem);
    const result = await run(`/api/inventory/items/${itemId}/tiers`, "PUT", { tiers: built.tiers });
    if (result.ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormError message={error} />
      {saved ? <p role="status" className="status-success rounded-atlas-md px-3 py-2 text-sm">Tiers saved.</p> : null}
      {rows.length === 0 ? <p className="text-sm text-muted">No price tiers. Add tiers such as Good / Better / Best for flat-rate pricing.</p> : null}
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
            <div>
              <label htmlFor={`tier-label-${row.key}`} className="mb-1 block text-xs font-medium text-muted">Label</label>
              <input id={`tier-label-${row.key}`} value={row.label} disabled={!canEdit} onChange={(e) => update(row.key, { label: e.target.value })} className={fieldClass} placeholder={`Tier ${index + 1}`} />
            </div>
            <div>
              <label htmlFor={`tier-price-${row.key}`} className="mb-1 block text-xs font-medium text-muted">Price ($)</label>
              <input id={`tier-price-${row.key}`} inputMode="decimal" value={row.price} disabled={!canEdit} onChange={(e) => update(row.key, { price: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`tier-member-${row.key}`} className="mb-1 block text-xs font-medium text-muted">Member ($)</label>
              <input id={`tier-member-${row.key}`} inputMode="decimal" value={row.memberPrice} disabled={!canEdit} onChange={(e) => update(row.key, { memberPrice: e.target.value })} className={fieldClass} />
            </div>
            {canEdit && (!savedIds.has(row.key) || canRemoveSaved) ? (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove tier ${row.label || index + 1}`} onClick={() => void remove(row)} disabled={pending}>
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((current) => [...current, { key: `new-${(draftCounter += 1)}`, label: "", price: "", memberPrice: "" }])}
          >
            <Plus size={16} aria-hidden="true" />
            Add tier
          </Button>
          <Button type="submit" disabled={pending || rows.length === 0}>{pending ? "Saving…" : "Save tiers"}</Button>
        </div>
      ) : null}
    </form>
  );
}
