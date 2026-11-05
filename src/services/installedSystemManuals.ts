import "server-only";

import type { InstalledSystemManualsView } from "@/features/manuals/types/manuals";
import { ManualValidationError } from "@/features/manuals/utils/manualErrors";
import { composeSystemManuals, fromStoredLink, MAX_SUGGESTIONS } from "@/features/manuals/utils/composeManuals";
import { matchManualsForSystem } from "@/features/manuals/utils/manualMatch";
import { canManageManuals } from "@/features/manuals/utils/manualRoles";
import { buildSystemPlacement } from "@/features/manuals/utils/systemPlacement";
import { readDriveSyncConfig } from "@/lib/manuals/driveConfig";
import { listDriveManualFiles } from "@/repositories/driveManuals";
import {
  deleteManualDecision,
  listInstallJobsForProperty,
  listManualLinksForSystems,
  loadJobById,
  loadSystemPlacementRow,
  upsertOfficeManualDecision,
  type PlacementJobRow,
} from "@/repositories/installedSystemManuals";

export { composeSystemManuals, MAX_SUGGESTIONS };

function mapJob(row: PlacementJobRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    jobNumber: row.job_number,
    title: row.title,
    type: row.type,
    status: row.status,
    scheduledFor: row.scheduled_for,
  };
}

export async function getInstalledSystemManuals(
  systemId: string,
  role: string,
): Promise<InstalledSystemManualsView | null> {
  const system = await loadSystemPlacementRow(systemId);
  if (!system) return null;

  const [files, stored, linkedJob, propertyJobs] = await Promise.all([
    listDriveManualFiles(),
    listManualLinksForSystems([systemId]),
    system.job_id ? loadJobById(system.job_id) : Promise.resolve(null),
    system.property_id ? listInstallJobsForProperty(system.property_id) : Promise.resolve([]),
  ]);

  const matches = matchManualsForSystem(
    { manufacturer: system.manufacturer, modelNumber: system.model_number, systemName: system.system_name },
    files,
  );
  const canManage = canManageManuals(role);

  return {
    systemId,
    ...composeSystemManuals(stored, matches, files),
    placement: buildSystemPlacement(
      {
        manufacturer: system.manufacturer,
        modelNumber: system.model_number,
        serialNumbers: system.serial_numbers ?? [],
        installDate: system.install_date,
        location: system.location,
        systemName: system.system_name,
        jobId: system.job_id,
        attributes: system.attributes,
      },
      mapJob(linkedJob),
      propertyJobs.map((j) => mapJob(j)!),
    ),
    canManage,
    library: canManage ? files.map((f) => ({ id: f.id, name: f.name, manufacturer: f.manufacturer })) : [],
    driveConnected: readDriveSyncConfig().status.configured,
  };
}

export type ManualDecisionAction = "confirm" | "unlink" | "clear";

export async function decideInstalledSystemManual(
  systemId: string,
  body: Record<string, unknown>,
): Promise<InstalledSystemManualsView["linked"][number] | { cleared: true }> {
  const manualId = typeof body.manualId === "string" ? body.manualId.trim() : "";
  const action = body.action;
  if (!/^[0-9a-f-]{36}$/i.test(manualId)) throw new ManualValidationError("manualId must be a valid id.");
  if (action !== "confirm" && action !== "unlink" && action !== "clear") {
    throw new ManualValidationError("action must be confirm, unlink or clear.");
  }

  if (action === "clear") {
    await deleteManualDecision(systemId, manualId);
    return { cleared: true };
  }

  const system = await loadSystemPlacementRow(systemId);
  if (!system) throw Object.assign(new Error("Installed system not found."), { status: 404 });
  const files = await listDriveManualFiles({ includeRemoved: true });
  const file = files.find((f) => f.id === manualId);
  if (!file) throw Object.assign(new Error("Manual not found."), { status: 404 });

  const match = matchManualsForSystem(
    { manufacturer: system.manufacturer, modelNumber: system.model_number, systemName: system.system_name },
    [{ ...file, status: "active" }],
  )[0];

  const stored = await upsertOfficeManualDecision({
    installedSystemId: systemId,
    manualId,
    status: action === "confirm" ? "confirmed" : "rejected",
    kind: match?.kind ?? "manual",
    confidence: action === "confirm" ? 1 : (match?.confidence ?? 0),
    reason:
      action === "confirm"
        ? match
          ? `Confirmed by office. ${match.reason}`
          : "Linked by hand by office."
        : match
          ? `Unlinked by office. ${match.reason}`
          : "Unlinked by office.",
  });
  const view = fromStoredLink(stored);
  if (!view) throw Object.assign(new Error("Manual not found."), { status: 404 });
  return view;
}
