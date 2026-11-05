import {
  TECHNICAL_SECTION_LABELS,
  type JobTechnicalData,
  type TechnicalDataFact,
  type TechnicalDataSection,
  type TechnicalDataSystem,
  type TechnicalManualMatch,
  type TechnicalSectionKey,
} from "../types/jobMaterials";
import type { InstalledSystemManual } from "@/features/manuals/types/manuals";

// ------------------------------------------------------------------
// Inputs — the minimum the builder needs from the live tables
// (installed_systems, technical_profiles, knowledge_items,
// knowledge_relationships). Repository maps rows into these.
// ------------------------------------------------------------------

export interface TechnicalSystemInput {
  id: string;
  systemName: string;
  manufacturer: string;
  modelNumber: string;
  serialNumbers: string[];
  location: string;
  installDate: string;
  jobId: string | null;
  linkedWorkflowIds: string[];
  technicalProfileId: string | null;
  attributes: unknown;
}

export interface TechnicalProfileInput {
  id: string;
  equipmentType: string;
  permitFields: unknown;
  knownFacts: unknown;
  discoveredFacts: unknown;
}

export interface KnowledgeItemInput {
  id: string;
  title: string;
  status: string;
  knowledgeType: string;
  tags: string[];
}

export interface KnowledgeLinkInput {
  knowledgeItemId: string;
  relatedEntityId: string;
}

// ------------------------------------------------------------------
// Fact classification
// ------------------------------------------------------------------

/** technical_profiles.permit_fields keys → section + label. */
const PERMIT_FIELD_MAP: Record<string, { section: TechnicalSectionKey; label: string; unit?: string }> = {
  voltage: { section: "electrical", label: "Voltage" },
  mca: { section: "electrical", label: "MCA (min circuit amps)" },
  mocp: { section: "electrical", label: "MOCP (max breaker)" },
  refrigerant: { section: "refrigerant", label: "Refrigerant" },
  coolingCapacityBtu: { section: "capacity", label: "Cooling capacity", unit: "BTU/h" },
  heatingCapacityBtu: { section: "capacity", label: "Heating capacity", unit: "BTU/h" },
  seer2: { section: "capacity", label: "SEER2" },
  eer2: { section: "capacity", label: "EER2" },
  hspf2: { section: "capacity", label: "HSPF2" },
  fuelType: { section: "capacity", label: "Fuel" },
  ahriNumber: { section: "capacity", label: "AHRI #" },
  dimensions: { section: "physical", label: "Dimensions" },
  weightLbs: { section: "physical", label: "Weight", unit: "lb" },
  indoorSoundDb: { section: "physical", label: "Indoor sound", unit: "dB" },
  outdoorSoundDb: { section: "physical", label: "Outdoor sound", unit: "dB" },
};

const SECTION_PATTERNS: Array<[TechnicalSectionKey, RegExp]> = [
  ["clearances", /clearance|setback|service access|airflow space/i],
  ["refrigerant", /charge|refrigerant|r-?410|r-?32|r-?454|subcool|superheat|line ?set|liquid line|suction|txv|metering|\boz\b/i],
  ["electrical", /volt|amp|\bmca\b|\bmocp\b|breaker|fuse|wire|awg|phase|electrical|disconnect|\bhz\b/i],
  ["capacity", /btu|ton|seer|eer|hspf|afue|capacity|cfm|efficiency|input|output/i],
  ["physical", /dimension|weight|size|\bdb\b|sound|height|width|depth/i],
];

export function classifyTechnicalFact(label: string): TechnicalSectionKey {
  for (const [section, pattern] of SECTION_PATTERNS) {
    if (pattern.test(label)) return section;
  }
  return "other";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("en-US") : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value.trim() || null;
  return null;
}

function factList(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const shown = displayValue(record.value);
    if (label && shown) out.push({ label, value: shown });
  }
  return out;
}

function profileFacts(profile: TechnicalProfileInput | undefined) {
  const facts: Array<TechnicalDataFact & { section: TechnicalSectionKey }> = [];
  if (!profile) return facts;
  const permit = asRecord(profile.permitFields);
  for (const [key, spec] of Object.entries(PERMIT_FIELD_MAP)) {
    const shown = displayValue(permit[key]);
    if (!shown) continue;
    facts.push({
      section: spec.section,
      label: spec.label,
      value: spec.unit ? `${shown} ${spec.unit}` : shown,
      source: "technical_profile",
    });
  }
  const seen = new Set(facts.map((fact) => fact.label.toLowerCase()));
  for (const fact of [...factList(profile.knownFacts), ...factList(profile.discoveredFacts)]) {
    const key = fact.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ ...fact, section: classifyTechnicalFact(fact.label), source: "technical_profile" });
  }
  return facts;
}

/**
 * Service Fusion custom fields carried on installed_systems.attributes.
 * Keeps the technical ones (filter size, etc.) and drops anything that looks
 * like a person/contact field — this panel is for the crew, not CRM data.
 */
const NON_TECHNICAL_FIELD = /customer|client|owner|tenant|contact|phone|e-?mail|address|\bname\b/i;

function recordFields(attributes: unknown): { label: string; value: string }[] {
  const attrs = asRecord(attributes);
  const out: { label: string; value: string }[] = [];
  const custom = asRecord(attrs.custom_fields);
  for (const [label, raw] of Object.entries(custom)) {
    if (NON_TECHNICAL_FIELD.test(label)) continue;
    const shown = displayValue(raw);
    if (shown) out.push({ label, value: shown });
  }
  const sku = displayValue(attrs.sku);
  if (sku) out.push({ label: "SKU", value: sku });
  if (attrs.extended_warranty === true) out.push({ label: "Extended warranty", value: "Yes" });
  return out;
}

// ------------------------------------------------------------------
// Company Brain matching
// ------------------------------------------------------------------

export function normalizeModel(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function usableModel(model: string): string | null {
  const normalized = normalizeModel(model);
  if (normalized.length < 4 || normalized === "UNKNOWN") return null;
  return normalized;
}

/**
 * Tokens for the knowledge_items lookup. Tag matching is case-sensitive in
 * Postgres arrays, so each token is sent as typed, lower, and upper.
 * Model tokens for the title search are restricted to [A-Za-z0-9-] so they
 * are safe inside a PostgREST or() filter.
 */
export function knowledgeSearchTokens(systems: ReadonlyArray<TechnicalSystemInput>): {
  tags: string[];
  titleModels: string[];
} {
  const tags = new Set<string>();
  const titleModels = new Set<string>();
  for (const system of systems) {
    for (const raw of [system.manufacturer, system.modelNumber]) {
      const value = raw.trim();
      if (!value || value.toLowerCase() === "unknown") continue;
      tags.add(value);
      tags.add(value.toLowerCase());
      tags.add(value.toUpperCase());
    }
    const model = system.modelNumber.trim().replace(/[^A-Za-z0-9-]/g, "");
    if (usableModel(model)) titleModels.add(model);
  }
  return { tags: [...tags].slice(0, 120), titleModels: [...titleModels].slice(0, 40) };
}

function manualsForSystem(
  system: TechnicalSystemInput,
  knowledge: ReadonlyArray<KnowledgeItemInput>,
  linkedItemIds: ReadonlySet<string>,
): TechnicalManualMatch[] {
  const model = usableModel(system.modelNumber);
  const manufacturer = system.manufacturer.trim().toLowerCase();
  const matches: TechnicalManualMatch[] = [];
  for (const item of knowledge) {
    if (item.status === "archived") continue;
    let matchedBy: TechnicalManualMatch["matchedBy"] | null = null;
    if (linkedItemIds.has(item.id)) {
      matchedBy = "linked";
    } else if (
      model &&
      (item.tags.some((tag) => normalizeModel(tag) === model) ||
        normalizeModel(item.title).includes(model))
    ) {
      matchedBy = "model";
    } else if (
      manufacturer &&
      manufacturer !== "unknown" &&
      item.tags.some((tag) => tag.trim().toLowerCase() === manufacturer)
    ) {
      matchedBy = "manufacturer";
    }
    if (matchedBy) {
      matches.push({
        id: item.id,
        title: item.title,
        status: item.status,
        knowledgeType: item.knowledgeType,
        matchedBy,
      });
    }
  }
  const rank = { linked: 0, model: 1, manufacturer: 2 } as const;
  return matches.sort((a, b) => rank[a.matchedBy] - rank[b.matchedBy] || a.title.localeCompare(b.title));
}

// ------------------------------------------------------------------
// Builder
// ------------------------------------------------------------------

const SECTION_ORDER: TechnicalSectionKey[] = [
  "electrical",
  "refrigerant",
  "clearances",
  "capacity",
  "physical",
  "other",
];

export function buildJobTechnicalData(input: {
  jobId: string;
  propertyId: string | null;
  systems: ReadonlyArray<TechnicalSystemInput>;
  profiles: ReadonlyArray<TechnicalProfileInput>;
  knowledge: ReadonlyArray<KnowledgeItemInput>;
  links: ReadonlyArray<KnowledgeLinkInput>;
  /** #8: Drive manuals per installed system id (linked + best matches). */
  driveManuals?: ReadonlyMap<string, InstalledSystemManual[]>;
}): JobTechnicalData {
  const profilesById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const linksBySystem = new Map<string, Set<string>>();
  const jobLinked = new Set<string>();
  for (const link of input.links) {
    if (link.relatedEntityId === input.jobId) {
      jobLinked.add(link.knowledgeItemId);
      continue;
    }
    const set = linksBySystem.get(link.relatedEntityId) ?? new Set<string>();
    set.add(link.knowledgeItemId);
    linksBySystem.set(link.relatedEntityId, set);
  }

  const systems: TechnicalDataSystem[] = input.systems.map((system) => {
    const facts = profileFacts(
      system.technicalProfileId ? profilesById.get(system.technicalProfileId) : undefined,
    );
    const sections: TechnicalDataSection[] = SECTION_ORDER.map((key) => ({
      key,
      label: TECHNICAL_SECTION_LABELS[key],
      facts: facts
        .filter((fact) => fact.section === key)
        .map(({ label, value, source }) => ({ label, value, source })),
    })).filter((section) => section.facts.length > 0);

    const linked = new Set([...(linksBySystem.get(system.id) ?? []), ...jobLinked]);
    return {
      id: system.id,
      systemName: system.systemName,
      manufacturer: system.manufacturer,
      modelNumber: system.modelNumber,
      serialNumbers: system.serialNumbers,
      location: system.location,
      installDate: system.installDate,
      onThisJob:
        system.jobId === input.jobId || system.linkedWorkflowIds.includes(input.jobId),
      hasSpecs: sections.length > 0,
      sections,
      recordFields: recordFields(system.attributes),
      manuals: manualsForSystem(system, input.knowledge, linked),
      driveManuals: input.driveManuals?.get(system.id) ?? [],
    };
  });

  systems.sort(
    (a, b) =>
      Number(b.onThisJob) - Number(a.onThisJob) ||
      a.systemName.localeCompare(b.systemName) ||
      a.id.localeCompare(b.id),
  );

  const gaps: string[] = [];
  if (systems.length === 0) {
    gaps.push(
      input.propertyId
        ? "No equipment on file for this job or property yet. Add it on the Systems tab and its specs show up here."
        : "This job has no property, so there is no equipment to pull specs from.",
    );
  } else {
    if (!systems.some((system) => system.hasSpecs)) {
      gaps.push(
        "Equipment is on file, but no charge, clearance or electrical specs are recorded for it yet.",
      );
    }
    if (!systems.some((system) => system.manuals.length > 0 || system.driveManuals.length > 0)) {
      gaps.push("No Company Brain or Drive manuals match this equipment yet.");
    }
  }

  return { jobId: input.jobId, propertyId: input.propertyId, systems, gaps };
}

/**
 * Dispatch "Technical" chip from what the board already knows:
 *   no equipment            → attention (amber)
 *   equipment, no specs     → attention (amber)
 *   equipment with a profile→ satisfied (green)
 */
export function technicalReadinessFromCounts(counts: {
  systems: number;
  withProfile: number;
}): { state: "satisfied" | "attention_needed"; reason: string } {
  if (counts.systems === 0) {
    return { state: "attention_needed", reason: "No equipment on file" };
  }
  if (counts.withProfile === 0) {
    return { state: "attention_needed", reason: "Equipment on file, no specs yet" };
  }
  return { state: "satisfied", reason: "Specs on file" };
}
