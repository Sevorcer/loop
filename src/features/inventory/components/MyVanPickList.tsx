"use client";

import { useRef, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { MyVanPickLine } from "../utils/myVanView";
import { parseQuantity } from "../utils/quantity";
import { negativeOnHandWarning, projectedOnHand } from "../utils/stockView";
import { FormError, FormWarning } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface MyVanPickListProps {
  vehicleId: string;
  shopName: string | null;
  shopReady: boolean;
  lines: MyVanPickLine[];
}

interface Draft {
  checked: boolean;
  qty: string;
}

function initialDrafts(lines: readonly MyVanPickLine[]): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const line of lines) {
    drafts[line.itemId] = {
      checked: line.suggestedQty > 0,
      qty: line.suggestedQty > 0 ? String(line.suggestedQty) : "",
    };
  }
  return drafts;
}

function stepQty(raw: string, delta: number): string {
  const parsed = parseQuantity(raw);
  const current = parsed !== undefined && parsed > 0 ? parsed : 0;
  const next = Math.round((current + delta) * 1000) / 1000;
  if (next <= 0) return "";
  return String(next);
}

/**
 * Self-serve pick list for this van. Shop on-hand is shown on these lines only.
 * A short shop warns and does not block. Uncheck a line to leave it.
 */
export function MyVanPickList({ vehicleId, shopName, shopReady, lines }: MyVanPickListProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const lock = useRef(false);
  const [drafts, setDrafts] = useState(() => initialDrafts(lines));
  const [sealed, setSealed] = useState(false);
  const shopLabel = shopName ?? "Shop";

  function update(itemId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || pending || sealed || !shopReady) return;
    const payload: { itemId: string; qty: number }[] = [];
    for (const line of lines) {
      const draft = drafts[line.itemId];
      if (!draft?.checked) continue;
      const parsed = parseQuantity(draft.qty);
      if (parsed === undefined || parsed <= 0) {
        setError("Use a pull quantity greater than zero, or uncheck the line.");
        return;
      }
      payload.push({ itemId: line.itemId, qty: parsed });
    }
    if (payload.length === 0) {
      setError("Check at least one line to pull.");
      return;
    }

    lock.current = true;
    try {
      const result = await run("/api/inventory/my-van/restock", "POST", { vehicleId, lines: payload });
      if (!result.ok) {
        lock.current = false;
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
      <ul className="space-y-3">
        {lines.map((line) => {
          const draft = drafts[line.itemId] ?? { checked: true, qty: String(line.suggestedQty) };
          const parsed = parseQuantity(draft.qty);
          const warning =
            draft.checked && shopReady && parsed !== undefined && parsed > 0 && line.shopOnHand != null
              ? negativeOnHandWarning({
                  itemName: line.name,
                  locationName: shopLabel,
                  projected: projectedOnHand(line.shopOnHand, -parsed),
                })
              : null;
          return (
            <li key={line.itemId} className="rounded-atlas-md border border-default bg-surface-elevated p-4">
              <div className="flex items-start gap-3">
                <input
                  id={`pull-${line.itemId}`}
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                  checked={draft.checked}
                  onChange={(event) => update(line.itemId, { checked: event.target.checked })}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`pull-${line.itemId}`} className="text-base font-medium text-primary">
                    {line.name}
                  </label>
                  {line.sku ? <p className="text-xs text-muted">{line.sku}</p> : null}
                  <p className="mt-1 text-sm text-muted">
                    On truck {line.onHand}
                    {line.unit ? ` ${line.unit}` : ""} · Par {line.minQty}
                    {line.shopOnHand != null ? ` · ${shopLabel} ${line.shopOnHand}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {line.negative ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                    <StatusBadge variant="warning">Below par</StatusBadge>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-atlas-md border border-default text-lg text-primary transition-colors hover:bg-surface"
                  aria-label={`Decrease ${line.name}`}
                  onClick={() => update(line.itemId, { qty: stepQty(draft.qty, -1), checked: true })}
                >
                  −
                </button>
                <label className="sr-only" htmlFor={`qty-${line.itemId}`}>
                  Pull quantity for {line.name}
                </label>
                <input
                  id={`qty-${line.itemId}`}
                  inputMode="decimal"
                  value={draft.qty}
                  onChange={(event) => update(line.itemId, { qty: event.target.value, checked: true })}
                  className={`${fieldClass} min-h-11 text-center text-base`}
                />
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-atlas-md border border-default text-lg text-primary transition-colors hover:bg-surface"
                  aria-label={`Increase ${line.name}`}
                  onClick={() => update(line.itemId, { qty: stepQty(draft.qty, 1), checked: true })}
                >
                  +
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">Suggested {line.suggestedQty}</p>
              <FormWarning message={warning} />
            </li>
          );
        })}
      </ul>
      <Button type="submit" className="min-h-11 w-full" disabled={pending || sealed || !shopReady}>
        {pending || sealed ? "Posting…" : "I pulled these"}
      </Button>
    </form>
  );
}
