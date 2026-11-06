"use client";

import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/atlas/StatusBadge";

import type { MyVanCard } from "../utils/myVanView";
import { filterMyVanCards } from "../utils/myVanView";
import { fieldClass } from "./formStyles";

interface MyVanOnTruckProps {
  cards: MyVanCard[];
}

function quantityLabel(onHand: number, unit: string | null): string {
  return unit ? `${onHand} ${unit}` : String(onHand);
}

/** On-hand cards. Search stays on the phone. Shop quantity is not on these cards. */
export function MyVanOnTruck({ cards }: MyVanOnTruckProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterMyVanCards(cards, query), [cards, query]);

  return (
    <div className="space-y-3">
      <label htmlFor="my-van-search" className="sr-only">
        Search the truck
      </label>
      <input
        id="my-van-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name or SKU…"
        className={fieldClass}
      />
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{query.trim() ? "No items match." : "No stockable items yet."}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((card) => (
            <li key={card.itemId} className="rounded-atlas-md border border-default bg-surface-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-primary">{card.name}</h3>
                  {card.sku ? <p className="mt-0.5 text-xs text-muted">{card.sku}</p> : null}
                </div>
                {card.belowPar || card.negative ? (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {card.negative ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                    {card.belowPar ? <StatusBadge variant="warning">Below par</StatusBadge> : null}
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-semibold text-primary">{quantityLabel(card.onHand, card.unit)}</p>
              <p className="text-sm text-muted">{card.minQty == null ? "Par —" : `Par ${card.minQty}`}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
