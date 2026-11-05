"use client";

import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import { FormError } from "./FormMessages";

interface LocationActiveToggleProps {
  locationId: string;
  name: string;
  isActive: boolean;
}

export function LocationActiveToggle({ locationId, name, isActive }: LocationActiveToggleProps) {
  const { run, pending, error } = useInventoryMutation();
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`${isActive ? "Deactivate" : "Reactivate"} ${name}`}
        onClick={() => void run(`/api/inventory/locations/${locationId}`, "PATCH", { isActive: !isActive })}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </Button>
      <FormError message={error} />
    </div>
  );
}
