import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repo = vi.hoisted(() => ({
  listSystemsForMatching: vi.fn(),
  loadSystemPlacementRow: vi.fn(),
  recordManualAutoMatch: vi.fn(),
}));
const drive = vi.hoisted(() => ({ listDriveManualFiles: vi.fn() }));
vi.mock("@/repositories/installedSystemManuals", () => repo);
vi.mock("@/repositories/driveManuals", () => drive);

import type { DriveManualFile } from "@/features/manuals/types/manuals";
import { autoMatchAllSystems, autoMatchManualsForSystem, tryAutoMatchManualsForSystem } from "@/services/manualAutoMatch";

const f = (id: string, name: string, manufacturer: string, models: string[]): DriveManualFile => ({
  id, driveFileId: id, name, mimeType: "application/pdf", folderPath: "", driveModifiedAt: null, webViewLink: "", sizeBytes: null,
  parsedManufacturer: manufacturer, parsedManufacturers: [manufacturer], parsedModels: models, docType: "install",
  manufacturerOverride: null, modelOverride: null, manufacturer, models, status: "active", lastSeenAt: "", updatedAt: "",
});
const files = [f("m1", "MSZ-GL09NA install.pdf", "Mitsubishi", ["MSZ-GL09NA"]), f("m2", "Coleman guide.pdf", "Coleman", [])];

beforeEach(() => {
  for (const fn of [...Object.values(repo), ...Object.values(drive)]) fn.mockReset();
  vi.unstubAllEnvs();
  drive.listDriveManualFiles.mockResolvedValue(files);
  repo.recordManualAutoMatch.mockResolvedValue(1);
});

describe("autoMatchManualsForSystem", () => {
  it("records an auto-link for an exact model and returns the reason", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue({ id: "s1", system_name: "Head", manufacturer: "Mitsubishi", model_number: "msz-gl09na" });
    const summary = await autoMatchManualsForSystem("s1");
    expect(repo.recordManualAutoMatch).toHaveBeenCalledWith("s1", [expect.objectContaining({ manual_id: "m1", status: "auto_linked", match_kind: "model_exact" })]);
    expect(summary?.reason).toContain("MSZ-GL09NA install.pdf");
  });

  it("clears stale Copilot rows (empty list) when nothing model-level matches", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue({ id: "s1", system_name: "Furnace", manufacturer: "Coleman", model_number: "X1" });
    const summary = await autoMatchManualsForSystem("s1");
    expect(repo.recordManualAutoMatch).toHaveBeenCalledWith("s1", []);
    expect(summary?.action).toBe("none");
  });

  it("returns null for a hidden system; try* swallows errors", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue(null);
    expect(await autoMatchManualsForSystem("s1")).toBeNull();
    repo.loadSystemPlacementRow.mockRejectedValue(new Error("function record_manual_auto_match does not exist"));
    expect(await tryAutoMatchManualsForSystem("s1")).toBeNull();
  });
});

describe("autoMatchAllSystems", () => {
  it("only writes for systems with model-level matches", async () => {
    repo.listSystemsForMatching.mockResolvedValue([
      { id: "a", system_name: "Head", manufacturer: "Mitsubishi", model_number: "MSZ-GL09NA" },
      { id: "b", system_name: "Furnace", manufacturer: "Coleman", model_number: "X" },
      { id: "c", system_name: "?", manufacturer: "Rheem", model_number: "R" },
    ]);
    const result = await autoMatchAllSystems();
    expect(result).toEqual({ systemsChecked: 3, systemsMatched: 1, autoLinked: 1, suggested: 0, truncated: false });
    expect(repo.recordManualAutoMatch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the index is empty", async () => {
    drive.listDriveManualFiles.mockResolvedValue([]);
    repo.listSystemsForMatching.mockResolvedValue([{ id: "a", system_name: "", manufacturer: "Mitsubishi", model_number: "MSZ-GL09NA" }]);
    expect((await autoMatchAllSystems()).systemsMatched).toBe(0);
    expect(repo.recordManualAutoMatch).not.toHaveBeenCalled();
  });
});
