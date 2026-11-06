"use client";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { ExpectedArrival } from "../types/arrivals";
import { ArrivalDialog } from "./ArrivalDialog";
import { FormError } from "./FormMessages";
import type { StockItemOption, StockLocationOption } from "./StockDialogTypes";

interface ArrivalRowActionsProps {
  arrival: ExpectedArrival;
  items: StockItemOption[];
  locations: StockLocationOption[];
}

/** Mark received (posts the ledger receive), edit, or cancel one open arrival. */
export function ArrivalRowActions({ arrival, items, locations }: ArrivalRowActionsProps) {
  const { run, pending, error } = useInventoryMutation();
  const base = `/api/inventory/arrivals/${encodeURIComponent(arrival.id)}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(`${base}/receive`, "POST")}>
          {pending ? "Working…" : "Mark received"}
        </Button>
        <ArrivalDialog arrival={arrival} items={items} locations={locations} />
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(base, "PATCH", { cancel: true })}>
          Cancel
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}
