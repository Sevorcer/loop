import { describe, expect, it } from "vitest";

import type { DriveManualFile } from "../types/manuals";
import { confidenceLevel, matchManualsForSystem } from "../utils/manualMatch";
import { parseManualName } from "../utils/parseManualName";

function fileFromName(id: string, name: string, extra: Partial<DriveManualFile> = {}): DriveManualFile {
  const parsed = parseManualName(name);
  return {
    id, driveFileId: id, name, mimeType: "application/pdf", folderPath: "Crew Install References", driveModifiedAt: null,
    webViewLink: "", sizeBytes: null, parsedManufacturer: parsed.manufacturer, parsedManufacturers: parsed.manufacturers,
    parsedModels: parsed.models, docType: parsed.docType, manufacturerOverride: null, modelOverride: null,
    manufacturer: parsed.manufacturer, models: parsed.models, status: "active", lastSeenAt: "", updatedAt: "", ...extra,
  };
}

const library = [
  fileFromName("coleman-qr", "Coleman_R454B_Install_Quick_Reference.pdf"),
  fileFromName("coleman-field", "Coleman — Field Reference"),
  fileFromName("trane-multi", "Trane / American Standard / Ameristar — Field Reference"),
  fileFromName("mitsu-guide", "Mitsubishi_Inverter_Components_Guide.pdf"),
  fileFromName("msz-exact", "MSZ-GL09NA_Installation_Manual.pdf", { manufacturer: "Mitsubishi", parsedManufacturers: ["Mitsubishi"] }),
  fileFromName("lennox-series", "Lennox ML14XC IOM.pdf"),
  fileFromName("gone", "Mitsubishi old.pdf", { status: "removed" }),
];

describe("matchManualsForSystem", () => {
  it("exact model in the file name is high confidence, case/punctuation-insensitive", () => {
    const [top] = matchManualsForSystem({ manufacturer: "Mitsubishi", modelNumber: "Msz-gL09na" }, library);
    expect(top).toMatchObject({ manualId: "msz-exact", kind: "model_exact", level: "high" });
    expect(top.reason).toContain("MSZ-GL09NA");
  });

  it("series in the file name is a medium model_family match", () => {
    const [top] = matchManualsForSystem({ manufacturer: "Lennox", modelNumber: "ML14XC1-036-230A" }, library);
    expect(top).toMatchObject({ manualId: "lennox-series", kind: "model_family", level: "medium" });
  });

  it("brand-only matches are low confidence guides, install/quick refs first", () => {
    const matches = matchManualsForSystem({ manufacturer: "Coleman", modelNumber: "TC5B4821S" }, library);
    expect(matches.map((m) => m.manualId)).toEqual(["coleman-qr", "coleman-field"]);
    expect(matches.every((m) => m.kind === "manufacturer" && m.level === "low")).toBe(true);
    expect(matches[0].reason).toContain("Same brand (Coleman)");
  });

  it("multi-brand references match each brand", () => {
    expect(matchManualsForSystem({ manufacturer: "American Standard", modelNumber: "x" }, library)[0].manualId).toBe("trane-multi");
    expect(matchManualsForSystem({ manufacturer: "Ameristar", modelNumber: "x" }, library)[0].manualId).toBe("trane-multi");
  });

  it("uses the system name when manufacturer is blank, and ignores placeholder models", () => {
    const matches = matchManualsForSystem(
      { manufacturer: "", modelNumber: "Unknown", systemName: "Ductless Wall Mount Head – Mitsubishi" },
      library,
    );
    expect(matches.map((m) => m.manualId).sort()).toEqual(["mitsu-guide", "msz-exact"].sort());
    expect(matches.every((m) => m.kind === "manufacturer")).toBe(true);
  });

  it("caps a model hit on a conflicting brand at medium", () => {
    const [top] = matchManualsForSystem({ manufacturer: "Daikin", modelNumber: "MSZ-GL09NA" }, library);
    expect(top.manualId).toBe("msz-exact");
    expect(top.confidence).toBeLessThanOrEqual(0.6);
    expect(top.reason).toContain("but the file is for Mitsubishi");
  });

  it("skips removed files and unrelated brands", () => {
    expect(matchManualsForSystem({ manufacturer: "Rheem", modelNumber: "RA1436AJ1NA" }, library)).toEqual([]);
    expect(matchManualsForSystem({ manufacturer: "Mitsubishi", modelNumber: "" }, library).map((m) => m.manualId)).not.toContain("gone");
  });

  it("office overrides drive matching", () => {
    const overridden = fileFromName("ovr", "01. Concealed Ducted IOM.pdf", { manufacturerOverride: "Hisense", manufacturer: "Hisense", models: ["AUD24UX4RBL4"] });
    expect(matchManualsForSystem({ manufacturer: "Hisense", modelNumber: "AUD24UX4RBL4" }, [overridden])[0]).toMatchObject({ kind: "model_exact", level: "high" });
  });

  it("confidence levels", () => {
    expect([0.97, 0.75, 0.4].map(confidenceLevel)).toEqual(["high", "medium", "low"]);
  });
});
