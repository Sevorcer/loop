"use client";

import { useEffect, useState } from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

export interface VehicleOption {
  id: string;
  name: string;
}

/**
 * Vehicles the reporter can pick from (active and out-of-service; retired are
 * excluded by the API). A failed read yields an empty list, and the form falls
 * back to typing a name, so a fetch problem never blocks reporting an issue.
 */
export function useVehicleOptions(): { options: VehicleOption[]; loaded: boolean } {
  const { role } = useCurrentRole();
  const [options, setOptions] = useState<VehicleOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    async function load() {
      try {
        const result = await requestJson<{ vehicles: Array<{ id: string; name: string }> }>(
          "/api/inventory/vehicles",
          { role, cache: "no-store" },
        );
        if (cancelled) return;
        setOptions(
          Array.isArray(result.vehicles)
            ? result.vehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.name }))
            : [],
        );
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return { options, loaded };
}
