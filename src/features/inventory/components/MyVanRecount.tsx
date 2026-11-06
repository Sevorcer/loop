"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { parseQuantity } from "../utils/quantity";
import { fieldClass } from "./formStyles";
import { FormError } from "./FormMessages";

interface RecountItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  onHand: number;
  minQty: number | null;
}

interface MyVanRecountProps {
  vehicleId: string;
  items: RecountItem[];
}

/**
 * Recount of the tech's own van. A blank line is skipped. A number that
 * matches on-hand posts nothing. This is a count, not a plus/minus adjustment.
 */
export function MyVanRecount({ vehicleId, items }: MyVanRecountProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const lock = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle
        ? items.filter((item) => [item.name, item.sku].some((value) => value?.toLowerCase().includes(needle)))
        : items,
    [items, needle],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || pending || sealed) return;
    setNotice(null);
    const lines: { itemId: string; countedQty: number }[] = [];
    for (const item of items) {
      const raw = (drafts[item.id] ?? "").trim();
      if (!raw) continue;
      const parsed = parseQuantity(raw);
      if (parsed === undefined || parsed < 0) {
        setError("A count is 0 or more, with at most 3 decimals. Leave a line blank to skip it.");
        return;
      }
      lines.push({ itemId: item.id, countedQty: parsed });
    }
    if (lines.length === 0) {
      setError("Type a quantity on at least one line. A blank line is skipped.");
      return;
    }

    lock.current = true;
    try {
      const result = await run("/api/inventory/my-van/count", "POST", { vehicleId, lines });
      if (!result.ok) {
        lock.current = false;
        return;
      }
      const data = result.data as { noChange?: boolean; posted?: number } | undefined;
      if (data?.noChange || !data?.posted) {
        lock.current = false;
        setNotice("Count matches on-hand. Nothing was posted.");
        return;
      }
      setSealed(true);
    } catch {
      lock.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={error} />
      {notice ? (
        <p role="status" className="status-info rounded-atlas-md px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <label htmlFor="recount-search" className="sr-only">
        Search recount
      </label>
      <input
        id="recount-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or SKU…"
        className={fieldClass}
      />
      <p className="text-sm text-muted">Leave a line blank to skip it. A number equal to on-hand posts nothing.</p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No items match.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="rounded-atlas-md border border-default bg-surface-elevated p-4">
              <h3 className="text-base font-medium text-primary">{item.name}</h3>
              {item.sku ? <p className="text-xs text-muted">{item.sku}</p> : null}
              <p className="mt-2 text-2xl font-semibold text-primary">
                {item.onHand}
                {item.unit ? <span className="ml-1 text-sm font-normal text-muted">{item.unit}</span> : null}
              </p>
              <p className="text-sm text-muted">{item.minQty == null ? "Par —" : `Par ${item.minQty}`}</p>
              <label htmlFor={`count-${item.id}`} className="mt-3 block text-xs font-medium uppercase tracking-wide text-muted">
                Counted
              </label>
              <input
                id={`count-${item.id}`}
                inputMode="decimal"
                value={drafts[item.id] ?? ""}
                onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder={String(item.onHand)}
                className={`${fieldClass} mt-1 min-h-11 text-base`}
              />
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" className="min-h-11 w-full" disabled={pending || sealed || items.length === 0}>
        {pending || sealed ? "Posting…" : "Save count"}
      </Button>
    </form>
  );
}
