"use client";

import { useRef, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { RestockGroup } from "../utils/parRules";
import { parseQuantity } from "../utils/quantity";
import { negativeOnHandWarning, projectedOnHand } from "../utils/stockView";
import { FormError, FormWarning } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface RestockPullTableProps {
  group: RestockGroup;
}

interface Draft {
  checked: boolean;
  qty: string;
}

function initialDrafts(group: RestockGroup): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const line of group.lines) {
    drafts[line.itemId] = { checked: true, qty: String(line.suggestedQty) };
  }
  return drafts;
}

/**
 * One van on Needs restock. Checked lines post as shop-to-van transfers.
 * Lowering a quantity or unchecking a line is the whole confirmation.
 * A short shop warns and does not block.
 */
export function RestockPullTable({ group }: RestockPullTableProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const lock = useRef(false);
  const [drafts, setDrafts] = useState(() => initialDrafts(group));
  const [sealed, setSealed] = useState(false);
  const shopName = group.shopLocationName ?? "the shop";
  const shopId = group.shopLocationId;

  function update(itemId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  const checkedCount = group.lines.filter((line) => drafts[line.itemId]?.checked).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || pending || sealed || !shopId) return;
    const lines: { itemId: string; fromLocationId: string; toLocationId: string; qty: number }[] = [];
    for (const line of group.lines) {
      const draft = drafts[line.itemId];
      if (!draft?.checked) continue;
      const parsed = parseQuantity(draft.qty);
      if (parsed === undefined || parsed <= 0) {
        setError("Use a pull quantity greater than zero, or uncheck the line.");
        return;
      }
      lines.push({
        itemId: line.itemId,
        fromLocationId: shopId,
        toLocationId: group.locationId,
        qty: parsed,
      });
    }
    if (lines.length === 0) {
      setError("Check at least one line to pull.");
      return;
    }

    lock.current = true;
    try {
      const result = await run("/api/inventory/restock", "POST", { lines });
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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Uncheck a line to leave it. Pull posts the checked lines onto the van.</p>
        <Button type="submit" className="min-h-11" disabled={pending || sealed || !shopId || checkedCount === 0}>
          {pending || sealed ? "Pulling…" : checkedCount > 0 ? `Pull ${checkedCount}` : "Pull"}
        </Button>
      </div>
      <div className="w-full overflow-x-auto rounded-atlas-md border border-default">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Needs restock on {group.vehicleName}</caption>
          <thead className="bg-surface-elevated">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                Pull
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted">
                On hand
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted">
                Minimum
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                Quantity
              </th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted">
                Shop on hand
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {group.lines.map((line) => {
              const draft = drafts[line.itemId] ?? { checked: true, qty: String(line.suggestedQty) };
              const parsed = parseQuantity(draft.qty);
              const warning =
                draft.checked && parsed !== undefined && parsed > 0 && line.shopOnHand != null
                  ? negativeOnHandWarning({
                      itemName: line.name,
                      locationName: shopName,
                      projected: projectedOnHand(line.shopOnHand, -parsed),
                    })
                  : null;
              return (
                <tr key={line.itemId} className="transition-colors hover:bg-surface-elevated">
                  <td className="px-3 py-3 align-middle">
                    <label className="flex min-h-11 items-center sm:min-h-0">
                      <input
                        type="checkbox"
                        checked={draft.checked}
                        onChange={(event) => update(line.itemId, { checked: event.target.checked })}
                        aria-label={`Pull ${line.name}`}
                      />
                    </label>
                  </td>
                  <th scope="row" className="px-3 py-3 text-left align-middle font-medium text-primary">
                    {line.name}
                    {line.sku ? <span className="ml-2 text-xs font-normal text-muted">{line.sku}</span> : null}
                  </th>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    <span className="font-semibold">{line.onHand}</span>
                    {line.unit ? <span className="ml-1 text-xs text-muted">{line.unit}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums text-muted">{line.minQty}</td>
                  <td className="px-3 py-3 align-middle">
                    <label htmlFor={`pull-${group.vehicleId}-${line.itemId}`} className="sr-only">
                      Pull quantity for {line.name}
                    </label>
                    <input
                      id={`pull-${group.vehicleId}-${line.itemId}`}
                      inputMode="decimal"
                      value={draft.qty}
                      onChange={(event) => update(line.itemId, { qty: event.target.value })}
                      disabled={!draft.checked || pending}
                      className={`${fieldClass} min-h-11 sm:max-w-28 sm:min-h-0`}
                    />
                    {warning ? (
                      <div className="mt-2 max-w-xs">
                        <FormWarning message={warning} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums text-muted">{line.shopOnHand ?? "—"}</td>
                  <td className="px-3 py-3 align-middle">
                    <span className="flex flex-wrap gap-1">
                      {line.negative ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                      <StatusBadge variant="warning">Below par</StatusBadge>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
