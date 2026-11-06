"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { ROUTES } from "@/lib/routes";

import type { KitItemOption } from "../types/kits";
import { fieldClass } from "./formStyles";

interface KitItemPickerProps {
  options: readonly KitItemOption[];
  /** Items already in the kit; an item can appear only once. */
  excludedIds: ReadonlySet<string>;
  onPick: (option: KitItemOption) => void;
}

const MAX_RESULTS = 8;

/** Search-and-add over the stocked catalog. Kits never take free-text items. */
export function KitItemPicker({ options, excludedIds, onPick }: KitItemPickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return options
      .filter((option) => !excludedIds.has(option.id))
      .filter((option) => {
        const haystack = `${option.name} ${option.sku ?? ""}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, MAX_RESULTS);
  }, [options, excludedIds, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-primary">
        Add an item from the catalog
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${options.length} stocked items by name or SKU`}
        autoComplete="off"
        className={fieldClass}
      />
      {searching ? (
        results.length > 0 ? (
          <ul aria-label="Matching catalog items" className="divide-y divide-[var(--border)] overflow-hidden rounded-atlas-md border border-default">
            {results.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(option);
                    setQuery("");
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
                  aria-label={`Add ${option.name}`}
                >
                  <span className="font-medium text-primary">{option.name}</span>
                  <span className="shrink-0 text-xs text-muted">{[option.sku, option.unit].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="text-sm text-muted">
            No stocked item matches. If it is not in the catalog yet,{" "}
            <Link href={ROUTES.INVENTORY_CATALOG} className="underline underline-offset-4 hover:text-primary">
              add it to the catalog
            </Link>{" "}
            first.
          </p>
        )
      ) : null}
    </div>
  );
}
