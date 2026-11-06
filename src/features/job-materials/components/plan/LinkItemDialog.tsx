"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ModalDialog } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { ROUTES } from "@/lib/routes";

import type { ActionResult } from "../../state/MaterialPlanProvider";
import { PlanError } from "./PlanFormParts";
import { planFieldClass } from "./planStyles";

interface ItemOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
}

interface LinkItemDialogProps {
  lineName: string;
  onSubmit: (values: { catalogItemId: string; writeAlias: boolean }) => Promise<ActionResult>;
  onClose: () => void;
}

/** Search the stocked catalog and link a needs-SKU line to one item. */
export function LinkItemDialog({ lineName, onSubmit, onClose }: LinkItemDialogProps) {
  const { role } = useCurrentRole();
  const [query, setQuery] = useState(lineName);
  const [results, setResults] = useState<ItemOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ItemOption | null>(null);
  const [writeAlias, setWriteAlias] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search over active stocked items.
  useEffect(() => {
    const term = query.trim();
    if (!role || term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void requestJson<{ items: ItemOption[] }>(
        `/api/inventory/items?facet=stockable&limit=8&search=${encodeURIComponent(term)}`,
        { role, cache: "no-store" },
      )
        .then((data) => {
          if (cancelled) return;
          setResults(data.items ?? []);
          setSearchError(null);
        })
        .catch(() => {
          if (!cancelled) setSearchError("Could not search the catalog.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, role]);

  async function link() {
    if (!picked) return;
    setPending(true);
    setError(null);
    const result = await onSubmit({ catalogItemId: picked.id, writeAlias });
    setPending(false);
    if (result.ok) onClose();
    else setError(result.message ?? "Could not link the item.");
  }

  return (
    <ModalDialog
      title="Link to a catalog item"
      description={`Pick the stocked item that “${lineName}” means.`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <PlanError message={error ?? searchError} />
        <div className="space-y-1.5">
          <label htmlFor="link-search" className="block text-sm font-medium text-primary">
            Search stocked items
          </label>
          <input
            id="link-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPicked(null);
            }}
            autoComplete="off"
            className={planFieldClass}
          />
        </div>

        {results.length > 0 ? (
          <ul aria-label="Matching catalog items" className="divide-y divide-[var(--border)] overflow-hidden rounded-atlas-md border border-default">
            {results.map((item) => {
              const selected = picked?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPicked(item)}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)] ${
                      selected ? "bg-surface-elevated" : "bg-surface hover:bg-surface-elevated"
                    }`}
                  >
                    <span className="font-medium text-primary">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted">{[item.sku, item.unit].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : query.trim().length >= 2 && !searching ? (
          <p role="status" className="text-sm text-muted">
            No stocked item matches.{" "}
            <Link href={ROUTES.INVENTORY_CATALOG} className="underline underline-offset-4 hover:text-primary">
              Add it to the catalog
            </Link>{" "}
            first, then come back.
          </p>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={writeAlias}
            onChange={(event) => setWriteAlias(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Remember this wording
            <span className="block text-xs text-muted">The next estimate that says “{lineName}” will match this item on its own.</span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void link()} disabled={!picked || pending}>
            {pending ? "Linking…" : picked ? `Link to ${picked.name}` : "Pick an item"}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
