import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repo = vi.hoisted(() => ({
  finishDriveSyncRun: vi.fn(),
  getLatestDriveSyncRun: vi.fn(),
  listDriveManualFiles: vi.fn(),
  listIndexedDriveFileIds: vi.fn(),
  markDriveManualFilesRemoved: vi.fn(),
  startDriveSyncRun: vi.fn(),
  updateDriveManualOverrides: vi.fn(),
  upsertDriveManualFiles: vi.fn(),
}));
vi.mock("@/repositories/driveManuals", () => repo);
vi.mock("@/lib/manuals/driveClient", () => ({ listManualFolderTree: vi.fn() }));

import { DriveNotConfiguredError, ManualValidationError } from "@/features/manuals/utils/manualErrors";
import { getDriveManualsSnapshot, syncDriveManuals, updateDriveManual } from "@/services/driveManuals";

const ENV = {
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "loop@proj.iam.gserviceaccount.com",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----",
  GOOGLE_DRIVE_MANUAL_FOLDER_IDS: "ROOTFOLDER01",
};

function listed(id: string, name: string) {
  return {
    driveFileId: id,
    name,
    mimeType: "application/pdf",
    folderPath: "Crew Install References",
    rootFolderId: "ROOTFOLDER01",
    parentFolderId: "ROOTFOLDER01",
    modifiedTime: null,
    webViewLink: `https://drive.google.com/file/d/${id}/view`,
    sizeBytes: 1,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const fn of Object.values(repo)) fn.mockReset();
  repo.startDriveSyncRun.mockResolvedValue("run-1");
  repo.finishDriveSyncRun.mockImplementation(async (id: string, r: Record<string, unknown>) => ({ id, ...r }));
});

function stubEnv(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

describe("syncDriveManuals", () => {
  it("refuses to run until the credential env vars are set", async () => {
    stubEnv({ GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "", GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "", GOOGLE_DRIVE_MANUAL_FOLDER_IDS: "" });
    await expect(syncDriveManuals()).rejects.toBeInstanceOf(DriveNotConfiguredError);
    expect(repo.startDriveSyncRun).not.toHaveBeenCalled();
  });

  it("upserts parsed files, counts adds/updates and marks unseen files removed", async () => {
    stubEnv(ENV);
    repo.listIndexedDriveFileIds.mockResolvedValue(
      new Map([
        ["f1", { id: "row-1", status: "active" }],
        ["gone", { id: "row-gone", status: "active" }],
        ["old", { id: "row-old", status: "removed" }],
      ]),
    );
    const listTree = vi.fn(async () => ({
      files: [listed("f1", "Coleman_R454B_Install_Quick_Reference.pdf"), listed("f2", "Lennox ML14XC1 IOM.pdf")],
      foldersVisited: 1,
      truncated: false,
    }));
    const afterSync = vi.fn(async () => undefined);
    const run = await syncDriveManuals({ listTree, afterSync });

    expect(run).toMatchObject({ status: "ok", filesSeen: 2, filesAdded: 1, filesUpdated: 1, filesRemoved: 1 });
    const upserted = repo.upsertDriveManualFiles.mock.calls[0][0] as Array<{ parsed: { manufacturer: string; models: string[] } }>;
    expect(upserted.map((u) => u.parsed.manufacturer)).toEqual(["Coleman", "Lennox"]);
    expect(upserted[1].parsed.models).toEqual(["ML14XC1"]);
    expect(repo.markDriveManualFilesRemoved).toHaveBeenCalledWith(["row-gone"]);
    expect(afterSync).toHaveBeenCalledTimes(1);
  });

  it("never marks files removed when the walk was truncated", async () => {
    stubEnv(ENV);
    repo.listIndexedDriveFileIds.mockResolvedValue(new Map([["gone", { id: "row-gone", status: "active" }]]));
    await syncDriveManuals({ listTree: async () => ({ files: [], foldersVisited: 300, truncated: true }) });
    expect(repo.markDriveManualFilesRemoved).toHaveBeenCalledWith([]);
  });

  it("records a failed run and rethrows", async () => {
    stubEnv(ENV);
    const failure = new Error("boom");
    await expect(syncDriveManuals({ listTree: async () => { throw failure; } })).rejects.toBe(failure);
    expect(repo.finishDriveSyncRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "error" }));
  });

  it("does not fail the sync when the after-sync hook throws", async () => {
    stubEnv(ENV);
    repo.listIndexedDriveFileIds.mockResolvedValue(new Map());
    const run = await syncDriveManuals({
      listTree: async () => ({ files: [], foldersVisited: 1, truncated: false }),
      afterSync: async () => { throw new Error("x"); },
    });
    expect(run.status).toBe("ok");
  });
});

describe("getDriveManualsSnapshot", () => {
  it("hides config details and sync runs from non-office roles", async () => {
    stubEnv(ENV);
    repo.listDriveManualFiles.mockResolvedValue([]);
    const snap = await getDriveManualsSnapshot("tech");
    expect(snap.canManage).toBe(false);
    expect(snap.config.serviceAccountEmail).toBeNull();
    expect(repo.getLatestDriveSyncRun).not.toHaveBeenCalled();
    repo.getLatestDriveSyncRun.mockResolvedValue(null);
    const office = await getDriveManualsSnapshot("office");
    expect(office.canManage).toBe(true);
    expect(office.config.serviceAccountEmail).toBe("loop@proj.iam.gserviceaccount.com");
  });
});

describe("updateDriveManual", () => {
  it("validates and trims overrides", async () => {
    repo.updateDriveManualOverrides.mockResolvedValue({ id: "m1" });
    await updateDriveManual("m1", { manufacturer: "  Daikin ", model: "" });
    expect(repo.updateDriveManualOverrides).toHaveBeenCalledWith("m1", { manufacturerOverride: "Daikin", modelOverride: null });
    await expect(updateDriveManual("m1", {})).rejects.toBeInstanceOf(ManualValidationError);
    await expect(updateDriveManual("m1", { model: 5 })).rejects.toBeInstanceOf(ManualValidationError);
    await expect(updateDriveManual("m1", { model: "x".repeat(101) })).rejects.toBeInstanceOf(ManualValidationError);
  });
});
