import "server-only";

import { listCrews } from "@/repositories/dispatch";

import type { CrewOption } from "../components/VehicleDialog";

/** Crews for the van assignment picker. A failed read yields an empty list rather than breaking the screen. */
export async function loadCrewOptions(): Promise<CrewOption[]> {
  try {
    const result = await listCrews({ pageSize: 200 });
    return result.ok ? result.data.map((crew) => ({ id: crew.id, name: crew.name })) : [];
  } catch {
    return [];
  }
}
