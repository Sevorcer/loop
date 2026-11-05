import { describe, expect, it } from "vitest";

import type { DriveManualFile } from "../types/manuals";
import { fileKindLabel, filterDriveManuals, manufacturerCounts } from "../utils/manualList";
import { canManageManuals, canReadManuals } from "../utils/manualRoles";

function file(partial: Partial<DriveManualFile>): DriveManualFile {
  return {
    id: "id", driveFileId: "d", name: "x.pdf", mimeType: "application/pdf", folderPath: "Crew Install References",
    driveModifiedAt: null, webViewLink: "", sizeBytes: null, parsedManufacturer: null, parsedManufacturers: [],
    parsedModels: [], docType: "other", manufacturerOverride: null, modelOverride: null, manufacturer: null,
    models: [], status: "active", lastSeenAt: "", updatedAt: "", ...partial,
  };
}

describe("manual list helpers", () => {
  const files = [
    file({ id: "1", name: "Coleman_R454B_Install_Quick_Reference.pdf", manufacturer: "Coleman", docType: "quick_reference" }),
    file({ id: "2", name: "Mitsubishi Electric — Field Reference", manufacturer: "Mitsubishi", mimeType: "application/vnd.google-apps.document" }),
    file({ id: "3", name: "MSZ install.pdf", manufacturer: "Mitsubishi", models: ["MSZ-GL09NA"] }),
  ];

  it("filters by words across name, brand, model and type", () => {
    expect(filterDriveManuals(files, "quick coleman").map((f) => f.id)).toEqual(["1"]);
    expect(filterDriveManuals(files, "gl09").map((f) => f.id)).toEqual(["3"]);
    expect(filterDriveManuals(files, "", "mitsubishi").map((f) => f.id)).toEqual(["2", "3"]);
  });

  it("counts brands, most first", () => {
    expect(manufacturerCounts(files)).toEqual([
      { manufacturer: "Mitsubishi", count: 2 },
      { manufacturer: "Coleman", count: 1 },
    ]);
  });

  it("labels file kinds", () => {
    expect(fileKindLabel("application/pdf")).toBe("PDF");
    expect(fileKindLabel("application/vnd.google-apps.document")).toBe("Google Doc");
  });

  it("role helpers match the RLS", () => {
    expect(["owner", "manager", "dispatch", "office"].every(canManageManuals)).toBe(true);
    expect(canManageManuals("tech")).toBe(false);
    expect(canReadManuals("tech")).toBe(true);
    expect(canReadManuals("portal")).toBe(false);
    expect(canReadManuals(null)).toBe(false);
  });
});
