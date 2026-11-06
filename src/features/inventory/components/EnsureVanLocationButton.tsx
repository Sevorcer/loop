"use client";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { FormError } from "./FormMessages";

/** Creates the stock location for a van that was saved without one. Safe to run twice. */
export function EnsureVanLocationButton({ vehicleId }: { vehicleId: string }) {
  const { run, pending, error } = useInventoryMutation();

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          void run(`/api/inventory/vehicles/${vehicleId}`, "PATCH", { ensureLocation: true });
        }}
      >
        {pending ? "Creating…" : "Create stock location"}
      </Button>
    </div>
  );
}
