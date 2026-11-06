"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { INITIAL_COUNT_REASON, OFFICE_RECOUNT_REASON, type CountSheetItem } from "../utils/countSheet";
import { parseQuantity } from "../utils/quantity";
import { FormError } from "./FormMessages";
import { fieldClass } from "./formStyles";

interface CountSheetProps {
  vehicleId: string;
  counted: boolean;
  items: CountSheetItem[];
}

/**
 * Office count-in and recount for one van. Blank lines are skipped. A number
 * that matches on-hand posts nothing. The button stays disabled while the
 * post is in flight.
 */
export function CountSheet({ vehicleId, counted, items }: CountSheetProps) {
  const router = useRouter();
  const { run, pending, error, setError } = useInventoryMutation();
  const lock = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(counted ? OFFICE_RECOUNT_REASON : INITIAL_COUNT_REASON);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sealed, setSealed] = useState(false);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle
        ? items.filter((item) => [item.name, item.sku, item.unit].some((value) => value?.toLowerCase().includes(needle)))
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
      const result = await run(`/api/inventory/vans/${vehicleId}/count`, "POST", {
        lines,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!result.ok) {
        lock.current = false;
        return;
      }
      const data = result.data as { noChange?: boolean; posted?: number } | undefined;
      if (data?.noChange || !data?.posted) {
        lock.current = false;
        setNotice(
          counted
            ? "Count matches on-hand. Nothing was posted."
            : "Every number matches on-hand, so nothing was posted. Restock alerts stay off until a count changes what the ledger has.",
        );
        return;
      }
      setSealed(true);
      router.push(ROUTE_BUILDERS.INVENTORY_VAN(vehicleId));
    } catch {
      lock.current = false;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      {notice ? (
        <p role="status" className="status-info rounded-atlas-md px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="count-search" className="sr-only">
            Search count sheet
          </label>
          <input
            id="count-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or SKU…"
            className={fieldClass}
          />
        </div>
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="count-reason" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Note
          </label>
          <input
            id="count-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            className={fieldClass}
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={pending || sealed || items.length === 0}>
          {pending || sealed ? "Posting…" : counted ? "Save recount" : "Post count-in"}
        </Button>
      </div>
      <p className="text-sm text-muted">
        Leave a line blank to skip it. A number equal to on-hand posts nothing.         To adjust another location, use{" "}
        <Link href={ROUTES.INVENTORY} className="font-medium text-accent hover:underline">
          Adjust / Count on Stock
        </Link>
        .
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">No items match your search.</p>
      ) : (
        <div className="w-full overflow-x-auto rounded-atlas-md border border-default">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Count sheet</caption>
            <thead className="bg-surface-elevated">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Item
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted">
                  On hand
                </th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted">
                  Par
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Counted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-surface-elevated">
                  <th scope="row" className="px-3 py-3 text-left align-middle font-medium text-primary">
                    {item.name}
                    {item.sku ? <span className="ml-2 text-xs font-normal text-muted">{item.sku}</span> : null}
                  </th>
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    <span className="text-lg font-semibold">{item.onHand}</span>
                    {item.unit ? <span className="ml-1 text-xs text-muted">{item.unit}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right align-middle tabular-nums text-muted">{item.minQty ?? "—"}</td>
                  <td className="px-3 py-3 align-middle">
                    <label htmlFor={`count-${item.id}`} className="sr-only">
                      Counted quantity for {item.name}
                    </label>
                    <input
                      id={`count-${item.id}`}
                      inputMode="decimal"
                      value={drafts[item.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="Blank"
                      className={`${fieldClass} min-h-11 sm:max-w-40 sm:min-h-0`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
