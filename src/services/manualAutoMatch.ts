import "server-only";

import {
  autoLinkThreshold,
  planManualAutoMatch,
  type AutoMatchSummary,
} from "@/features/copilot/manualAutoMatch";
import { matchManualsForSystem } from "@/features/manuals/utils/manualMatch";
import { listDriveManualFiles } from "@/repositories/driveManuals";
import {
  listSystemsForMatching,
  loadSystemPlacementRow,
  recordManualAutoMatch,
} from "@/repositories/installedSystemManuals";

/**
 * #8 — run Copilot's manual auto-match for one installed system and store
 * the model-level results (auto-link above the threshold, suggestion below).
 * Callers treat failure as non-fatal: equipment saves never fail on this.
 */
export async function autoMatchManualsForSystem(systemId: string): Promise<AutoMatchSummary | null> {
  const system = await loadSystemPlacementRow(systemId);
  if (!system) return null;
  const files = await listDriveManualFiles();
  const names = new Map(files.map((f) => [f.id, f.name]));
  const matches = matchManualsForSystem(
    { manufacturer: system.manufacturer, modelNumber: system.model_number, systemName: system.system_name },
    files,
  );
  const plan = planManualAutoMatch(matches, { threshold: autoLinkThreshold(), manualName: (id) => names.get(id) });
  // Always call: an empty list clears this system's stale Copilot rows.
  await recordManualAutoMatch(systemId, plan.items);
  return plan.summary;
}

/** Cap per Drive sync so one sync stays well inside a Vercel function budget. */
export const BULK_AUTO_MATCH_LIMIT = 300;

export interface BulkAutoMatchResult {
  systemsChecked: number;
  systemsMatched: number;
  autoLinked: number;
  suggested: number;
  truncated: boolean;
}

/** After a Drive sync: store model-level matches for every system that has one. */
export async function autoMatchAllSystems(): Promise<BulkAutoMatchResult> {
  const [systems, files] = await Promise.all([listSystemsForMatching(), listDriveManualFiles()]);
  const threshold = autoLinkThreshold();
  const result: BulkAutoMatchResult = { systemsChecked: systems.length, systemsMatched: 0, autoLinked: 0, suggested: 0, truncated: false };
  if (files.length === 0) return result;

  for (const system of systems) {
    const plan = planManualAutoMatch(
      matchManualsForSystem(
        { manufacturer: system.manufacturer, modelNumber: system.model_number, systemName: system.system_name },
        files,
      ),
      { threshold },
    );
    if (plan.items.length === 0) continue;
    if (result.systemsMatched >= BULK_AUTO_MATCH_LIMIT) {
      result.truncated = true;
      break;
    }
    await recordManualAutoMatch(system.id, plan.items);
    result.systemsMatched += 1;
    result.autoLinked += plan.items.filter((i) => i.status === "auto_linked").length;
    result.suggested += plan.items.filter((i) => i.status === "suggested").length;
  }
  return result;
}

/** Route helper: never throws, returns null when matching is unavailable. */
export async function tryAutoMatchManualsForSystem(systemId: string): Promise<AutoMatchSummary | null> {
  try {
    return await autoMatchManualsForSystem(systemId);
  } catch {
    // e.g. migration not applied yet, or Drive index empty — equipment save still succeeds.
    return null;
  }
}
