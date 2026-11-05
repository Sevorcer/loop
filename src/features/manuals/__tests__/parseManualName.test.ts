import { describe, expect, it } from "vitest";

import {
  canonicalManufacturer,
  detectDocType,
  findManufacturers,
  findModelTokens,
  normalizeModelNumber,
  parseManualName,
} from "../utils/parseManualName";

describe("parseManualName — names from Collin's Drive (Nov 4 inventory)", () => {
  it.each([
    ["American_Standard_R454B_Install_Quick_Reference.pdf", "American Standard", "quick_reference"],
    ["Bosch IDS (R-454B) — Install & Field Reference", "Bosch", "field_reference"],
    ["Coleman_R454B_Install_Quick_Reference.pdf", "Coleman", "quick_reference"],
    ["Hisense HD Service Parameters — Field Reference", "Hisense", "service"],
    ["Mitsubishi Electric — Field Reference", "Mitsubishi", "field_reference"],
    ["Mitsubishi_Inverter_Components_Guide.pdf", "Mitsubishi", "guide"],
    ["Honeywell_Zoning_Reference.pdf", "Honeywell", "guide"],
    ["SpacePakLoadForm.pdf", "SpacePak", "form"],
    ["Highlight-install-725.pdf", "High-Light", "install"],
    ["High-Light_Island-Ceiling_Spec_Sheet.pdf", "High-Light", "spec_sheet"],
    ["AIO Wall Mounted Pro (Gen 2) Installation Guide - Ephoca (V 5.0)", "Ephoca", "install"],
    ["Bosch Ultra HP install.pdf", "Bosch", "install"],
    ["01. Concealed Ducted IOM.pdf", null, "iom"],
    ["02. Concealed Ducted & Cassette Service Manual.pdf", null, "service"],
    ["03. Wired Controller Install-User Manual.pdf", null, "user"],
    ["Field_Fixes_Install_Issues_and_Resolutions.pdf", null, "guide"],
    ["Job_Prep_Packet_Template.pdf", null, "form"],
  ])("%s → %s / %s", (name, manufacturer, docType) => {
    const parsed = parseManualName(name);
    expect(parsed.manufacturer).toBe(manufacturer);
    expect(parsed.docType).toBe(docType);
  });

  it("lists every brand on a multi-brand reference, in order", () => {
    expect(parseManualName("Trane / American Standard / Ameristar — Field Reference").manufacturers).toEqual([
      "Trane",
      "American Standard",
      "Ameristar",
    ]);
  });

  it("does not treat refrigerants, versions, years or titles as models", () => {
    expect(parseManualName("Coleman_R454B_Install_Quick_Reference.pdf").models).toEqual([]);
    expect(parseManualName("Bosch IDS (R-454B) — Install & Field Reference").models).toEqual([]);
    expect(parseManualName("AIO Wall Mounted Pro (Gen 2) Installation Guide - Ephoca (V 5.0)").models).toEqual([]);
    expect(parseManualName("Highlight-install-725.pdf").models).toEqual([]);
    expect(findModelTokens("Service bulletin 2024")).toEqual([]);
  });

  it("finds real model numbers", () => {
    expect(parseManualName("MSZ-GL09NA_Installation_Manual.pdf")).toMatchObject({
      models: ["MSZ-GL09NA"],
      docType: "install",
    });
    expect(parseManualName("Lennox ML14XC1 IOM.pdf")).toMatchObject({
      manufacturer: "Lennox",
      models: ["ML14XC1"],
      docType: "iom",
    });
    expect(findModelTokens("Goodman GCS16-024-50-4P service manual")).toEqual(["GCS16-024-50-4P"]);
  });

  it("falls back to the folder path for the brand", () => {
    expect(parseManualName("Wall unit install.pdf", "Crew Install References / Daikin").manufacturer).toBe("Daikin");
  });

  it("does not match brand names inside other words", () => {
    expect(findManufacturers("Yorkshire heating notes")).toEqual([]);
    expect(findManufacturers("Lgarage plan")).toEqual([]);
  });

  it("canonicalizes manufacturer spellings", () => {
    expect(canonicalManufacturer("MITSUBISHI ELECTRIC")).toBe("Mitsubishi");
    expect(canonicalManufacturer("american standard")).toBe("American Standard");
    expect(canonicalManufacturer("Acme Heat")).toBe("Acme Heat");
    expect(canonicalManufacturer("")).toBeNull();
  });

  it("normalizes model numbers for comparison", () => {
    expect(normalizeModelNumber("Msz-gL06na")).toBe("MSZGL06NA");
    expect(normalizeModelNumber(null)).toBe("");
  });

  it("returns other for unknown document kinds", () => {
    expect(detectDocType("IMG_2041.jpg")).toBe("other");
  });
});
