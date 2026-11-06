"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { VanCopySource } from "../types/vans";
import { formatParInput, parInputProblem, parseParInput } from "../utils/parRules";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

export interface ParEditorItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
}

export interface ParEditorInitial {
  itemId: string;
  minQty: number | null;
  maxQty: number | null;
}

interface ParEditorProps {
  locationId: string;
  items: ParEditorItem[];
  initial: ParEditorInitial[];
  sources: VanCopySource[];
}

interface Draft {
  min: string;
  max: string;
}

function draftsFrom(items: readonly ParEditorItem[], initial: readonly ParEditorInitial[]): Record<string, Draft> {
  const byItem = new Map(initial.map((row) => [row.itemId, row]));
  const drafts: Record<string, Draft> = {};
  for (const item of items) {
    const row = byItem.get(item.id);
    drafts[item.id] = { min: formatParInput(row?.minQty), max: formatParInput(row?.maxQty) };
  }
  return drafts;
}

/** Minimum and fill-to for one van. Copy fills the inputs and does not save. */
export function ParEditor({ locationId, items, initial, sources }: ParEditorProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [drafts, setDrafts] = useState(() => draftsFrom(items, initial));
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

  const initialByItem = useMemo(() => new Map(initial.map((row) => [row.itemId, row])), [initial]);

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      const draft = drafts[item.id] ?? { min: "", max: "" };
      const min = parseParInput(draft.min);
      const max = parseParInput(draft.max);
      if (!min.ok || !max.ok) {
        ids.push(item.id);
        continue;
      }
      const saved = initialByItem.get(item.id);
      const savedMin = saved?.minQty ?? null;
      const savedMax = saved?.maxQty ?? null;
      if (min.value !== savedMin || max.value !== savedMax) ids.push(item.id);
    }
    return ids;
  }, [drafts, initialByItem, items]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) => [item.name, item.sku, item.unit].some((value) => value?.toLowerCase().includes(needle)))
    : items;

  function update(itemId: string, key: keyof Draft, value: string) {
    setCopiedFrom(null);
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], [key]: value } }));
  }

  function applyCopy() {
    const source = sources.find((row) => row.vehicleId === sourceId);
    if (!source) return;
    const byItem = new Map(source.pars.map((row) => [row.itemId, row]));
    setDrafts(() => {
      const next: Record<string, Draft> = {};
      for (const item of items) {
        const par = byItem.get(item.id);
        next[item.id] = { min: formatParInput(par?.minQty), max: formatParInput(par?.maxQty) };
      }
      return next;
    });
    setCopiedFrom(source.name);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (dirtyIds.length === 0) return;
    for (const itemId of dirtyIds) {
      const draft = drafts[itemId];
      const problem = parInputProblem(draft?.min ?? "", draft?.max ?? "");
      if (problem) return setError(problem);
    }
    const rows = dirtyIds.map((itemId) => {
      const min = parseParInput(drafts[itemId].min);
      const max = parseParInput(drafts[itemId].max);
      return {
        itemId,
        minQty: min.ok ? min.value : null,
        maxQty: max.ok ? max.value : null,
      };
    });
    const result = await run("/api/inventory/pars", "POST", { locationId, rows });
    if (result.ok) setCopiedFrom(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {copiedFrom ? (
        <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm text-primary" role="status">
          Copied from {copiedFrom}. Save to keep these numbers.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="par-search" className="sr-only">Search pars</label>
          <input
            id="par-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or SKU…"
            className={fieldClass}
          />
        </div>
        {sources.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="par-copy-source" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Copy from another van
              </label>
              <select id="par-copy-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} className={fieldClass}>
                <option value="">Choose a van</option>
                {sources.map((source) => (
                  <option key={source.vehicleId} value={source.vehicleId}>{source.name}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={applyCopy} disabled={!sourceId || pending}>
              Copy numbers
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Add another van when you want to copy its numbers.</p>
        )}
        <Button type="submit" disabled={pending || dirtyIds.length === 0}>
          {pending ? "Saving…" : dirtyIds.length > 0 ? `Save ${dirtyIds.length}` : "Save pars"}
        </Button>
      </div>
      <p className="text-sm text-muted">Blank means this item is not tracked on this van. Fill to is optional.</p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No items match your search.</p>
      ) : (
        <div className="w-full overflow-x-auto rounded-atlas-md border border-default">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Par levels</caption>
            <thead className="bg-surface-elevated">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">Item</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">Minimum</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">Fill to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((item) => {
                const draft = drafts[item.id] ?? { min: "", max: "" };
                return (
                  <tr key={item.id} className="transition-colors hover:bg-surface-elevated">
                    <th scope="row" className="px-3 py-3 text-left align-middle font-medium text-primary">
                      {item.name}
                      {item.sku ? <span className="ml-2 text-xs font-normal text-muted">{item.sku}</span> : null}
                    </th>
                    <td className="px-3 py-3 align-middle">
                      <label htmlFor={`par-min-${item.id}`} className="sr-only">{item.name} minimum</label>
                      <input
                        id={`par-min-${item.id}`}
                        inputMode="decimal"
                        value={draft.min}
                        onChange={(event) => update(item.id, "min", event.target.value)}
                        className={`${fieldClass} min-h-11 sm:min-h-0`}
                        placeholder="Blank"
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <label htmlFor={`par-max-${item.id}`} className="sr-only">{item.name} fill to</label>
                      <input
                        id={`par-max-${item.id}`}
                        inputMode="decimal"
                        value={draft.max}
                        onChange={(event) => update(item.id, "max", event.target.value)}
                        className={`${fieldClass} min-h-11 sm:min-h-0`}
                        placeholder="Blank"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
