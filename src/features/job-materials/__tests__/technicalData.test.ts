import { describe, expect, it } from "vitest";

import {
  buildJobTechnicalData,
  classifyTechnicalFact,
  knowledgeSearchTokens,
  technicalReadinessFromCounts,
  type TechnicalSystemInput,
} from "../utils/technicalData";

const JOB = "job-1";

function system(overrides: Partial<TechnicalSystemInput> = {}): TechnicalSystemInput {
  return {
    id: "sys-1",
    systemName: "Ductless Heat Pump – Mitsubishi",
    manufacturer: "Mitsubishi",
    modelNumber: "MUZ-GL09NA",
    serialNumbers: ["123"],
    location: "Garage",
    installDate: "2024-05-01",
    jobId: null,
    linkedWorkflowIds: [],
    technicalProfileId: null,
    attributes: {},
    ...overrides,
  };
}

describe("classifyTechnicalFact", () => {
  it.each([
    ["Factory charge (oz)", "refrigerant"],
    ["Additional charge per ft", "refrigerant"],
    ["Line set size", "refrigerant"],
    ["Side clearance", "clearances"],
    ["Breaker size", "electrical"],
    ["Wire gauge (AWG)", "electrical"],
    ["AFUE", "capacity"],
    ["Weight", "physical"],
    ["Condensate routing", "other"],
  ])("%s → %s", (label, section) => {
    expect(classifyTechnicalFact(label)).toBe(section);
  });
});

describe("buildJobTechnicalData", () => {
  it("groups profile specs into sections with units", () => {
    const data = buildJobTechnicalData({
      jobId: JOB,
      propertyId: "prop-1",
      systems: [system({ technicalProfileId: "tp-1" })],
      profiles: [
        {
          id: "tp-1",
          equipmentType: "Heat pump",
          permitFields: { voltage: "208/230", mca: "12", mocp: "15", refrigerant: "R-410A", coolingCapacityBtu: 9000 },
          knownFacts: [
            { id: "f1", label: "Factory charge", value: "2 lb 10 oz" },
            { id: "f2", label: "Rear clearance", value: '4"' },
            { id: "f3", label: "Voltage", value: "duplicate ignored" },
          ],
          discoveredFacts: [{ id: "f4", label: "Max line set", value: "65 ft" }],
        },
      ],
      knowledge: [],
      links: [],
    });

    const [only] = data.systems;
    expect(only.hasSpecs).toBe(true);
    const byKey = Object.fromEntries(only.sections.map((s) => [s.key, s.facts.map((f) => `${f.label}=${f.value}`)]));
    expect(byKey.electrical).toEqual(["Voltage=208/230", "MCA (min circuit amps)=12", "MOCP (max breaker)=15"]);
    expect(byKey.refrigerant).toEqual(["Refrigerant=R-410A", "Factory charge=2 lb 10 oz", "Max line set=65 ft"]);
    expect(byKey.clearances).toEqual(['Rear clearance=4"']);
    expect(byKey.capacity).toEqual(["Cooling capacity=9,000 BTU/h"]);
    expect(only.sections.map((s) => s.key)).toEqual(["electrical", "refrigerant", "clearances", "capacity"]);
  });

  it("keeps technical record fields and drops person/contact fields", () => {
    const data = buildJobTechnicalData({
      jobId: JOB,
      propertyId: "prop-1",
      systems: [
        system({
          attributes: {
            custom_fields: {
              "Filter Size(s)": "20x25x4",
              "Retail Space Customer": "Someone's shop",
              "Contact Phone": "555",
              "Thermostat": "",
            },
            sku: "SKU-9",
            extended_warranty: true,
          },
        }),
      ],
      profiles: [],
      knowledge: [],
      links: [],
    });
    expect(data.systems[0].recordFields).toEqual([
      { label: "Filter Size(s)", value: "20x25x4" },
      { label: "SKU", value: "SKU-9" },
      { label: "Extended warranty", value: "Yes" },
    ]);
  });

  it("matches Company Brain by link, model, then manufacturer and skips archived", () => {
    const data = buildJobTechnicalData({
      jobId: JOB,
      propertyId: "prop-1",
      systems: [system()],
      profiles: [],
      knowledge: [
        { id: "k-brand", title: "Mitsubishi startup SOP", status: "published", knowledgeType: "sop", tags: ["mitsubishi"] },
        { id: "k-model", title: "MUZ-GL09NA install manual", status: "draft", knowledgeType: "installation_guide", tags: [] },
        { id: "k-link", title: "Garage unit notes", status: "published", knowledgeType: "faq", tags: [] },
        { id: "k-old", title: "MUZ-GL09NA old manual", status: "archived", knowledgeType: "installation_guide", tags: [] },
        { id: "k-other", title: "Trane XR14", status: "published", knowledgeType: "sop", tags: ["trane"] },
      ],
      links: [{ knowledgeItemId: "k-link", relatedEntityId: "sys-1" }],
    });
    expect(data.systems[0].manuals.map((m) => [m.id, m.matchedBy])).toEqual([
      ["k-link", "linked"],
      ["k-model", "model"],
      ["k-brand", "manufacturer"],
    ]);
  });

  it("puts systems on this job first and explains gaps", () => {
    const data = buildJobTechnicalData({
      jobId: JOB,
      propertyId: "prop-1",
      systems: [
        system({ id: "a", systemName: "A furnace" }),
        system({ id: "b", systemName: "B condenser", linkedWorkflowIds: [JOB] }),
      ],
      profiles: [],
      knowledge: [],
      links: [],
    });
    expect(data.systems.map((s) => [s.id, s.onThisJob])).toEqual([
      ["b", true],
      ["a", false],
    ]);
    expect(data.gaps).toHaveLength(2);

    const none = buildJobTechnicalData({ jobId: JOB, propertyId: null, systems: [], profiles: [], knowledge: [], links: [] });
    expect(none.gaps[0]).toMatch(/no property/);
  });
});

describe("knowledgeSearchTokens", () => {
  it("sends case variants for tags and sanitizes title models", () => {
    const tokens = knowledgeSearchTokens([
      system({ modelNumber: "Msz-gL06na" }),
      system({ manufacturer: "Unknown", modelNumber: "Unknown" }),
      system({ modelNumber: "ABC,(x)*1234" }),
    ]);
    expect(tokens.tags).toEqual(expect.arrayContaining(["Mitsubishi", "mitsubishi", "MITSUBISHI", "Msz-gL06na", "MSZ-GL06NA"]));
    expect(tokens.tags).not.toContain("Unknown");
    expect(tokens.titleModels).toEqual(["Msz-gL06na", "ABCx1234"]);
  });
});

describe("technicalReadinessFromCounts", () => {
  it("is amber without equipment or specs, green with a profile", () => {
    expect(technicalReadinessFromCounts({ systems: 0, withProfile: 0 }).state).toBe("attention_needed");
    expect(technicalReadinessFromCounts({ systems: 3, withProfile: 0 }).reason).toMatch(/no specs/);
    expect(technicalReadinessFromCounts({ systems: 3, withProfile: 1 }).state).toBe("satisfied");
  });
});
