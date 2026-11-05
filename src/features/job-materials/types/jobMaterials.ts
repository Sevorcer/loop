// ============================================================
// Job materials + technical data — #23 (Dispatch)
//
// A materials line is one part/consumable a job needs. It moves through
// three states: needed → on_truck → used. Inventory (bundlec-note-inventory,
// phases 2–3) later attaches a catalog item and stock movements to the same
// transitions; this type is the stable contract the UI talks to.
// ============================================================

import type { ReadinessState } from "@/features/dispatch/types/dispatch";

export const JOB_MATERIAL_STATES = ["needed", "on_truck", "used"] as const;
export type JobMaterialState = (typeof JOB_MATERIAL_STATES)[number];

export const JOB_MATERIAL_STATE_LABELS: Record<JobMaterialState, string> = {
  needed: "Needed",
  on_truck: "On truck",
  used: "Used",
};

export interface JobMaterialLine {
  id: string;
  jobId: string;
  name: string;
  quantity: number;
  unit: string;
  partNumber: string | null;
  notes: string;
  state: JobMaterialState;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  stateChangedBy: string | null;
  stateChangedAt: string | null;
}

/** Fields an office role may set when adding a line. */
export interface JobMaterialCreateInput {
  name: string;
  quantity: number;
  unit: string;
  partNumber: string | null;
  notes: string;
  state: JobMaterialState;
}

/** Fields that may change on an existing line (tech: state + quantity only). */
export interface JobMaterialPatchInput {
  name?: string;
  quantity?: number;
  unit?: string;
  partNumber?: string | null;
  notes?: string;
  state?: JobMaterialState;
}

export interface JobMaterialSummary {
  total: number;
  needed: number;
  onTruck: number;
  used: number;
}

export interface MaterialReadiness {
  state: ReadinessState;
  reason: string;
}

// ------------------------------------------------------------------
// Technical data
// ------------------------------------------------------------------

export type TechnicalSectionKey =
  | "electrical"
  | "refrigerant"
  | "clearances"
  | "capacity"
  | "physical"
  | "other";

export const TECHNICAL_SECTION_LABELS: Record<TechnicalSectionKey, string> = {
  electrical: "Electrical",
  refrigerant: "Refrigerant & charge",
  clearances: "Clearances",
  capacity: "Capacity & efficiency",
  physical: "Size & sound",
  other: "Other specs",
};

export type TechnicalFactSource = "technical_profile" | "equipment_record";

export interface TechnicalDataFact {
  label: string;
  value: string;
  source: TechnicalFactSource;
}

export interface TechnicalDataSection {
  key: TechnicalSectionKey;
  label: string;
  facts: TechnicalDataFact[];
}

export interface TechnicalManualMatch {
  id: string;
  title: string;
  status: string;
  knowledgeType: string;
  /** Why it matched — shown to the user so a weak match is obvious. */
  matchedBy: "linked" | "model" | "manufacturer";
}

export interface TechnicalDataSystem {
  id: string;
  systemName: string;
  manufacturer: string;
  modelNumber: string;
  serialNumbers: string[];
  location: string;
  installDate: string;
  /** true when the record is tied to this job; false when it is just at the property. */
  onThisJob: boolean;
  hasSpecs: boolean;
  sections: TechnicalDataSection[];
  /** Extra fields carried on the equipment record (e.g. filter size from Service Fusion). */
  recordFields: { label: string; value: string }[];
  manuals: TechnicalManualMatch[];
}

export interface JobTechnicalData {
  jobId: string;
  propertyId: string | null;
  systems: TechnicalDataSystem[];
  /** Plain-English gaps the panel shows (no equipment, no specs, no manuals). */
  gaps: string[];
}
