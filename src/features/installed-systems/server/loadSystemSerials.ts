import "server-only";

import { systemSerialsFromUnits } from "@/features/inventory/utils/serialRules";
import { listSerialUnits } from "@/services/inventorySerialUnits";

/**
 * The serials of one installed system, read from its serial units (the source of
 * truth). Placeholder entries that exist only on the mirrored list are kept. If units
 * cannot be read, the mirrored list is shown rather than hiding the system.
 */
export async function loadSystemSerials(systemId: string, mirroredList: readonly string[]): Promise<string[]> {
  try {
    const units = await listSerialUnits({ installedSystemId: systemId });
    return systemSerialsFromUnits(units, mirroredList);
  } catch {
    return [...mirroredList];
  }
}
