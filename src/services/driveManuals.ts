import "server-only";

import type {
  DriveListedFile,
  DriveManualSyncRun,
  DriveManualsSnapshot,
} from "@/features/manuals/types/manuals";
import { canManageManuals } from "@/features/manuals/utils/manualRoles";
import { parseManualName } from "@/features/manuals/utils/parseManualName";
import {
  DriveNotConfiguredError,
  DriveSyncError,
  ManualValidationError,
} from "@/features/manuals/utils/manualErrors";
import { listManualFolderTree } from "@/lib/manuals/driveClient";
import { readDriveSyncConfig } from "@/lib/manuals/driveConfig";
import {
  finishDriveSyncRun,
  getLatestDriveSyncRun,
  listDriveManualFiles,
  listIndexedDriveFileIds,
  markDriveManualFilesRemoved,
  startDriveSyncRun,
  updateDriveManualOverrides,
  upsertDriveManualFiles,
} from "@/repositories/driveManuals";

export { DriveNotConfiguredError, ManualValidationError };

export async function getDriveManualsSnapshot(role: string): Promise<DriveManualsSnapshot> {
  const canManage = canManageManuals(role);
  const { status } = readDriveSyncConfig();
  const [files, lastRun] = await Promise.all([
    listDriveManualFiles(),
    canManage ? getLatestDriveSyncRun() : Promise.resolve(null),
  ]);
  return {
    files,
    lastRun,
    canManage,
    // Non-managers only learn whether Drive is connected, not the account.
    config: canManage ? status : { ...status, missing: [], serviceAccountEmail: null },
  };
}

export interface DriveSyncDeps {
  listTree?: typeof listManualFolderTree;
  /** Called after a successful sync (e.g. #8 Copilot auto-match). */
  afterSync?: (result: DriveManualSyncRun) => Promise<void>;
}

/** Only regular files are manuals; Drive folders, forms and sheets of other kinds still index (office can see everything shared). */
function isIndexable(file: DriveListedFile): boolean {
  return file.mimeType !== "application/vnd.google-apps.folder" && file.name.trim().length > 0;
}

export async function syncDriveManuals(deps: DriveSyncDeps = {}): Promise<DriveManualSyncRun> {
  const { config, status } = readDriveSyncConfig();
  if (!config) throw new DriveNotConfiguredError(status.missing);

  const runId = await startDriveSyncRun(config.folderIds.length);
  try {
    const tree = await (deps.listTree ?? listManualFolderTree)(config);
    const seenAt = new Date().toISOString();
    const listed = tree.files.filter(isIndexable);
    const existing = await listIndexedDriveFileIds();

    let added = 0;
    let updated = 0;
    const seenIds = new Set<string>();
    for (const file of listed) {
      seenIds.add(file.driveFileId);
      if (existing.has(file.driveFileId)) updated += 1;
      else added += 1;
    }

    await upsertDriveManualFiles(
      listed.map((file) => ({ listed: file, parsed: parseManualName(file.name, file.folderPath) })),
      seenAt,
    );

    // A truncated walk must not mark unseen files as removed.
    const removedIds = tree.truncated
      ? []
      : [...existing.entries()]
          .filter(([driveId, row]) => row.status === "active" && !seenIds.has(driveId))
          .map(([, row]) => row.id);
    await markDriveManualFilesRemoved(removedIds);

    const run = await finishDriveSyncRun(runId, {
      status: "ok",
      filesSeen: listed.length,
      filesAdded: added,
      filesUpdated: updated,
      filesRemoved: removedIds.length,
      error: tree.truncated ? "Drive walk stopped at the size limit; some files were not indexed." : null,
    });
    if (deps.afterSync) {
      try {
        await deps.afterSync(run);
      } catch {
        // Follow-up work (auto-match) must never fail the sync itself.
      }
    }
    return run;
  } catch (error) {
    const message =
      error instanceof DriveSyncError ? error.message : "Drive sync failed. Check the service account setup.";
    await finishDriveSyncRun(runId, { status: "error", error: message }).catch(() => undefined);
    throw error;
  }
}

const OVERRIDE_MAX = 100;

function cleanOverride(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new ManualValidationError(`${field} must be text or null.`);
  const trimmed = value.trim();
  if (trimmed.length > OVERRIDE_MAX) throw new ManualValidationError(`${field} must be ${OVERRIDE_MAX} characters or fewer.`);
  return trimmed || null;
}

export async function updateDriveManual(id: string, body: Record<string, unknown>) {
  const manufacturerOverride = cleanOverride(body.manufacturer, "manufacturer");
  const modelOverride = cleanOverride(body.model, "model");
  if (manufacturerOverride === undefined && modelOverride === undefined) {
    throw new ManualValidationError("Nothing to update. Send manufacturer and/or model.");
  }
  return updateDriveManualOverrides(id, { manufacturerOverride, modelOverride });
}
