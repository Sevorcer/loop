"use client";

import type { Dispatch, SetStateAction } from "react";

import { ITEM_KINDS, NON_STOCKABLE_KINDS, TRACKING_MODES } from "../types/catalog";
import type { FlatCategory } from "../utils/catalogView";
import type { ItemDraft } from "../utils/itemDraft";
import { FormField } from "./FormField";
import { fieldClass } from "./formStyles";

interface ItemFormFieldsProps {
  idPrefix: string;
  draft: ItemDraft;
  setDraft: Dispatch<SetStateAction<ItemDraft>>;
  categories: FlatCategory[];
  /** Render the cost block. Pass false for roles that may not see cost (the fields do not exist at all). */
  showCost: boolean;
  showActive?: boolean;
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 items-center gap-2 text-sm text-primary sm:min-h-0">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function ItemFormFields({ idPrefix, draft, setDraft, categories, showCost, showActive }: ItemFormFieldsProps) {
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const id = (name: string) => `${idPrefix}-${name}`;
  const kindLocksStock = NON_STOCKABLE_KINDS.includes(draft.itemKind);

  return (
    <div className="space-y-5">
      <FormField label="Name" htmlFor={id("name")}>
        <input id={id("name")} value={draft.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} maxLength={200} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Kind" htmlFor={id("kind")}>
          <select
            id={id("kind")}
            value={draft.itemKind}
            onChange={(e) => {
              const kind = e.target.value as ItemDraft["itemKind"];
              setDraft((current) => ({
                ...current,
                itemKind: kind,
                isStockable: NON_STOCKABLE_KINDS.includes(kind) ? false : current.isStockable,
              }));
            }}
            className={fieldClass}
          >
            {ITEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kind[0].toUpperCase() + kind.slice(1)}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Category" htmlFor={id("category")}>
          <select id={id("category")} value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{`${"— ".repeat(category.depth)}${category.name}`}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Description (optional)" htmlFor={id("description")}>
        <textarea id={id("description")} value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} className={fieldClass} />
      </FormField>

      <fieldset className="min-w-0 space-y-3 rounded-atlas-md border border-default p-4">
        <legend className="px-1 text-sm font-medium text-primary">Sell</legend>
        <Check id={id("sellable")} label="Sellable (appears on quotes and invoices)" checked={draft.isSellable} onChange={(v) => set("isSellable", v)} />
        {draft.isSellable ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Sell price ($)" htmlFor={id("sell")}>
              <input id={id("sell")} inputMode="decimal" value={draft.sellPrice} onChange={(e) => set("sellPrice", e.target.value)} className={fieldClass} placeholder="0.00" />
            </FormField>
            <FormField label="Member price ($, optional)" htmlFor={id("member")}>
              <input id={id("member")} inputMode="decimal" value={draft.memberPrice} onChange={(e) => set("memberPrice", e.target.value)} className={fieldClass} placeholder="0.00" />
            </FormField>
            <Check id={id("taxable")} label="Taxable" checked={draft.isTaxable} onChange={(v) => set("isTaxable", v)} />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-3 rounded-atlas-md border border-default p-4">
        <legend className="px-1 text-sm font-medium text-primary">Stock</legend>
        <Check id={id("stockable")} label="Stockable (counted in inventory)" checked={draft.isStockable && !kindLocksStock} onChange={(v) => set("isStockable", v)} />
        {kindLocksStock ? <p className="text-xs text-muted">Services and labor cannot be stocked.</p> : null}
        {draft.isStockable && !kindLocksStock ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="SKU" htmlFor={id("sku")}>
              <input id={id("sku")} value={draft.sku} onChange={(e) => set("sku", e.target.value)} className={fieldClass} />
            </FormField>
            <FormField label="Unit" htmlFor={id("unit")} hint="ea, ft, lb, box…">
              <input id={id("unit")} value={draft.unit} onChange={(e) => set("unit", e.target.value)} className={fieldClass} />
            </FormField>
            <FormField label="Tracking" htmlFor={id("tracking")}>
              <select id={id("tracking")} value={draft.trackingMode} onChange={(e) => set("trackingMode", e.target.value as ItemDraft["trackingMode"])} className={fieldClass}>
                {TRACKING_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode === "quantity" ? "By quantity" : "Serialized"}</option>
                ))}
              </select>
            </FormField>
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Brand" htmlFor={id("brand")}>
          <input id={id("brand")} value={draft.brand} onChange={(e) => set("brand", e.target.value)} className={fieldClass} />
        </FormField>
        <FormField label="Model" htmlFor={id("model")}>
          <input id={id("model")} value={draft.model} onChange={(e) => set("model", e.target.value)} className={fieldClass} />
        </FormField>
        <FormField label="Mfr part #" htmlFor={id("mfr")}>
          <input id={id("mfr")} value={draft.mfrPartNumber} onChange={(e) => set("mfrPartNumber", e.target.value)} className={fieldClass} />
        </FormField>
      </div>

      {showCost ? (
        <fieldset className="min-w-0 space-y-3 rounded-atlas-md border border-default p-4">
          <legend className="px-1 text-sm font-medium text-primary">Cost (internal)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Unit cost ($)" htmlFor={id("cost")}>
              <input id={id("cost")} inputMode="decimal" value={draft.unitCost} onChange={(e) => set("unitCost", e.target.value)} className={fieldClass} placeholder="0.00" />
            </FormField>
            <FormField label="Preferred vendor" htmlFor={id("vendor")}>
              <input id={id("vendor")} value={draft.preferredVendor} onChange={(e) => set("preferredVendor", e.target.value)} className={fieldClass} />
            </FormField>
          </div>
        </fieldset>
      ) : null}

      {showActive ? <Check id={id("active")} label="Active (inactive items are hidden from pickers)" checked={draft.isActive} onChange={(v) => set("isActive", v)} /> : null}
    </div>
  );
}
