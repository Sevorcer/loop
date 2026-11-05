import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repo = vi.hoisted(() => ({
  deleteManualDecision: vi.fn(),
  listInstallJobsForProperty: vi.fn(),
  listManualLinksForSystems: vi.fn(),
  loadJobById: vi.fn(),
  loadSystemPlacementRow: vi.fn(),
  upsertOfficeManualDecision: vi.fn(),
}));
const drive = vi.hoisted(() => ({ listDriveManualFiles: vi.fn() }));
vi.mock("@/repositories/installedSystemManuals", () => repo);
vi.mock("@/repositories/driveManuals", () => drive);

import type { DriveManualFile } from "@/features/manuals/types/manuals";
import { ManualValidationError } from "@/features/manuals/utils/manualErrors";
import type { StoredManualLink } from "@/repositories/installedSystemManuals";
import {
  composeSystemManuals,
  decideInstalledSystemManual,
  getInstalledSystemManuals,
} from "@/services/installedSystemManuals";

const SYS = "11111111-1111-4111-8111-111111111111";
const M1 = "22222222-2222-4222-8222-222222222221";
const M2 = "22222222-2222-4222-8222-222222222222";
const M3 = "22222222-2222-4222-8222-222222222223";

function file(id: string, name: string, manufacturer: string | null, models: string[] = [], docType: DriveManualFile["docType"] = "install"): DriveManualFile {
  return {
    id, driveFileId: id, name, mimeType: "application/pdf", folderPath: "", driveModifiedAt: null, webViewLink: "https://drive.google.com/x",
    sizeBytes: null, parsedManufacturer: manufacturer, parsedManufacturers: manufacturer ? [manufacturer] : [], parsedModels: models,
    docType, manufacturerOverride: null, modelOverride: null, manufacturer, models, status: "active", lastSeenAt: "", updatedAt: "",
  };
}

const files = [file(M1, "Coleman QR.pdf", "Coleman"), file(M2, "TC5B4821S install.pdf", "Coleman", ["TC5B4821S"]), file(M3, "Coleman field", "Coleman", [], "field_reference")];

function stored(manualId: string, status: StoredManualLink["status"], source: StoredManualLink["source"] = "office"): StoredManualLink {
  return { id: `l-${manualId}`, installedSystemId: SYS, manualId, status, source, kind: "manual", confidence: 1, reason: "r", decidedAt: "t", manual: files.find((f) => f.id === manualId)! };
}

beforeEach(() => {
  for (const fn of [...Object.values(repo), ...Object.values(drive)]) fn.mockReset();
  vi.unstubAllEnvs();
});

describe("composeSystemManuals", () => {
  it("puts confirmed + auto links in linked, hides decided manuals from suggestions, counts rejects", () => {
    const result = composeSystemManuals(
      [stored(M1, "rejected"), stored(M2, "confirmed")],
      [
        { manualId: M2, kind: "model_exact", confidence: 0.97, level: "high", reason: "x" },
        { manualId: M1, kind: "manufacturer", confidence: 0.4, level: "low", reason: "y" },
        { manualId: M3, kind: "manufacturer", confidence: 0.38, level: "low", reason: "z" },
      ],
      files,
    );
    expect(result.linked.map((l) => l.manual.id)).toEqual([M2]);
    expect(result.suggestions.map((s) => s.manual.id)).toEqual([M3]);
    expect(result.suggestions[0]).toMatchObject({ status: "match", source: "live" });
    expect(result.rejectedCount).toBe(1);
  });
});

describe("getInstalledSystemManuals", () => {
  it("returns null for an unknown/hidden system", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue(null);
    expect(await getInstalledSystemManuals(SYS, "office")).toBeNull();
  });

  it("matches live, builds placement and only gives office the library", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue({
      id: SYS, system_name: "Furnace – Coleman", manufacturer: "Coleman", model_number: "TC5B4821S", serial_numbers: ["S1"],
      install_date: "2024-05-01", location: "Basement", property_id: "p1", job_id: null, attributes: { custom_fields: { "Filter Size(s)": "16x25x1" } },
    });
    drive.listDriveManualFiles.mockResolvedValue(files);
    repo.listManualLinksForSystems.mockResolvedValue([]);
    repo.listInstallJobsForProperty.mockResolvedValue([{ id: "j1", job_number: "1001", title: "Install", type: "Install", status: "Completed", scheduled_for: "2024-04-28" }]);

    const office = await getInstalledSystemManuals(SYS, "office");
    expect(office?.suggestions[0]).toMatchObject({ kind: "model_exact", level: "high" });
    expect(office?.suggestions[0].manual.id).toBe(M2);
    expect(office?.placement.job).toMatchObject({ id: "j1", basis: "install_date" });
    expect(office?.placement.recordFields).toEqual([{ label: "Filter Size(s)", value: "16x25x1" }]);
    expect(office?.library).toHaveLength(3);
    expect(office?.driveConnected).toBe(false);
    expect(repo.loadJobById).not.toHaveBeenCalled();

    const tech = await getInstalledSystemManuals(SYS, "tech");
    expect(tech?.canManage).toBe(false);
    expect(tech?.library).toEqual([]);
  });
});

describe("decideInstalledSystemManual", () => {
  const systemRow = { id: SYS, system_name: "Furnace", manufacturer: "Coleman", model_number: "TC5B4821S", serial_numbers: [], install_date: null, location: null, property_id: null, job_id: null, attributes: null };

  it("validates the body", async () => {
    await expect(decideInstalledSystemManual(SYS, { manualId: "x", action: "confirm" })).rejects.toBeInstanceOf(ManualValidationError);
    await expect(decideInstalledSystemManual(SYS, { manualId: M1, action: "delete" })).rejects.toBeInstanceOf(ManualValidationError);
  });

  it("confirm stores an office decision with the match reason", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue(systemRow);
    drive.listDriveManualFiles.mockResolvedValue(files);
    repo.upsertOfficeManualDecision.mockImplementation(async (input: Record<string, unknown>) => ({ ...stored(M2, "confirmed"), reason: input.reason }));
    const result = await decideInstalledSystemManual(SYS, { manualId: M2, action: "confirm" });
    expect(repo.upsertOfficeManualDecision).toHaveBeenCalledWith(
      expect.objectContaining({ installedSystemId: SYS, manualId: M2, status: "confirmed", kind: "model_exact", confidence: 1 }),
    );
    expect((result as { reason: string }).reason).toMatch(/^Confirmed by office\. Model TC5B4821S/);
  });

  it("unlink stores a rejection; hand-picked manuals are kind manual", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue({ ...systemRow, manufacturer: "Rheem", model_number: "R1" });
    drive.listDriveManualFiles.mockResolvedValue(files);
    repo.upsertOfficeManualDecision.mockResolvedValue(stored(M1, "rejected"));
    await decideInstalledSystemManual(SYS, { manualId: M1, action: "unlink" });
    expect(repo.upsertOfficeManualDecision).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected", kind: "manual", reason: "Unlinked by office." }),
    );
  });

  it("404s for an unknown manual or system; clear deletes the decision", async () => {
    repo.loadSystemPlacementRow.mockResolvedValue(null);
    await expect(decideInstalledSystemManual(SYS, { manualId: M1, action: "confirm" })).rejects.toMatchObject({ status: 404 });
    repo.loadSystemPlacementRow.mockResolvedValue(systemRow);
    drive.listDriveManualFiles.mockResolvedValue([]);
    await expect(decideInstalledSystemManual(SYS, { manualId: M1, action: "confirm" })).rejects.toMatchObject({ status: 404 });
    await expect(decideInstalledSystemManual(SYS, { manualId: M1, action: "clear" })).resolves.toEqual({ cleared: true });
    expect(repo.deleteManualDecision).toHaveBeenCalledWith(SYS, M1);
  });
});
