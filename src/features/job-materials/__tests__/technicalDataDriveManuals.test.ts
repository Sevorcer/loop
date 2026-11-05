import { describe, expect, it } from "vitest";

import type { DriveManualFile, InstalledSystemManual } from "@/features/manuals/types/manuals";
import { driveManualsForTechnicalPanel, type StoredManualLinkLike } from "@/features/manuals/utils/composeManuals";

import { buildJobTechnicalData, type TechnicalSystemInput } from "../utils/technicalData";

const sys: TechnicalSystemInput = {
  id: "sys-1", systemName: "Ductless Heat Pump – Mitsubishi", manufacturer: "Mitsubishi", modelNumber: "MUZ-GL09NA",
  serialNumbers: [], location: "", installDate: "", jobId: "job-1", linkedWorkflowIds: [], technicalProfileId: null, attributes: {},
};

const file = (id: string, name: string, manufacturer: string, models: string[] = [], docType: DriveManualFile["docType"] = "install"): DriveManualFile => ({
  id, driveFileId: id, name, mimeType: "application/pdf", folderPath: "", driveModifiedAt: null, webViewLink: `https://drive.google.com/${id}`,
  sizeBytes: null, parsedManufacturer: manufacturer, parsedManufacturers: [manufacturer], parsedModels: models, docType,
  manufacturerOverride: null, modelOverride: null, manufacturer, models, status: "active", lastSeenAt: "", updatedAt: "",
});

describe("#8 Drive manuals in the Technical data panel", () => {
  const files = [
    file("exact", "MUZ-GL09NA install.pdf", "Mitsubishi", ["MUZ-GL09NA"]),
    file("guide1", "Mitsubishi_Inverter_Components_Guide.pdf", "Mitsubishi", [], "guide"),
    file("guide2", "Mitsubishi Electric — Field Reference", "Mitsubishi", [], "field_reference"),
    file("coleman", "Coleman QR.pdf", "Coleman"),
  ];
  const subject = { manufacturer: sys.manufacturer, modelNumber: sys.modelNumber, systemName: sys.systemName };

  it("shows linked manuals first, then only a strong extra match", () => {
    const stored: StoredManualLinkLike[] = [
      { manualId: "guide2", status: "confirmed", source: "office", kind: "manual", confidence: 1, reason: "Confirmed by office.", decidedAt: "t", manual: files[2] },
    ];
    const items = driveManualsForTechnicalPanel(subject, stored, files);
    expect(items.map((i) => [i.manual.id, i.status])).toEqual([["guide2", "confirmed"], ["exact", "match"]]);
  });

  it("with nothing linked, shows the top two possible matches; rejected never shows", () => {
    const stored: StoredManualLinkLike[] = [
      { manualId: "exact", status: "rejected", source: "office", kind: "model_exact", confidence: 0.97, reason: "", decidedAt: "t", manual: files[0] },
    ];
    const items = driveManualsForTechnicalPanel(subject, stored, files);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.manual.id)).not.toContain("exact");
    expect(items.every((i) => i.kind === "manufacturer")).toBe(true);
  });

  it("the builder attaches them per system and the gap text counts Drive manuals", () => {
    const driveManuals = new Map<string, InstalledSystemManual[]>([["sys-1", driveManualsForTechnicalPanel(subject, [], files)]]);
    const withDrive = buildJobTechnicalData({ jobId: "job-1", propertyId: "p", systems: [sys], profiles: [], knowledge: [], links: [], driveManuals });
    expect(withDrive.systems[0].driveManuals[0].manual.id).toBe("exact");
    expect(withDrive.gaps.join(" ")).not.toContain("manuals match");

    const without = buildJobTechnicalData({ jobId: "job-1", propertyId: "p", systems: [sys], profiles: [], knowledge: [], links: [] });
    expect(without.systems[0].driveManuals).toEqual([]);
    expect(without.gaps).toContain("No Company Brain or Drive manuals match this equipment yet.");
  });
});
