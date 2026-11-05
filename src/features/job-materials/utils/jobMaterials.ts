import {
  JOB_MATERIAL_STATES,
  type JobMaterialCreateInput,
  type JobMaterialLine,
  type JobMaterialPatchInput,
  type JobMaterialState,
  type JobMaterialSummary,
  type MaterialReadiness,
} from "../types/jobMaterials";

// ------------------------------------------------------------------
// Access — mirrors the RLS in 20261121000000_job_materials.sql.
// The database is the real gate; these keep the UI and API honest.
// ------------------------------------------------------------------

/** Full control: add, edit any field, delete. */
const MANAGE_ROLES = new Set(["owner", "manager", "dispatch", "office", "sales"]);
/** May move a line's state and change its quantity (techs: assigned jobs only, enforced by RLS). */
const PROGRESS_ROLES = new Set([...MANAGE_ROLES, "tech"]);

export function canManageJobMaterials(role: string | null | undefined): boolean {
  return MANAGE_ROLES.has(role ?? "");
}

export function canUpdateJobMaterialProgress(role: string | null | undefined): boolean {
  return PROGRESS_ROLES.has(role ?? "");
}

export function canViewJobMaterials(role: string | null | undefined): boolean {
  return PROGRESS_ROLES.has(role ?? "");
}

/** Keys a technician may send on PATCH. Anything else is a 403. */
export const TECH_PATCH_KEYS: ReadonlySet<string> = new Set(["state", "quantity"]);

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

export class JobMaterialValidationError extends Error {
  readonly status = 400;
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "JobMaterialValidationError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isJobMaterialState(value: unknown): value is JobMaterialState {
  return typeof value === "string" && (JOB_MATERIAL_STATES as readonly string[]).includes(value);
}

const MAX_NAME = 200;
const MAX_UNIT = 20;
const MAX_PART = 100;
const MAX_NOTES = 2000;
const MAX_QTY = 100000;

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new JobMaterialValidationError("Material name is required.");
  if (name.length > MAX_NAME) {
    throw new JobMaterialValidationError(`Material name must be ${MAX_NAME} characters or fewer.`);
  }
  return name;
}

function parseQuantity(value: unknown): number {
  const qty = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
    throw new JobMaterialValidationError("Quantity must be a number greater than 0.");
  }
  // numeric(12,3) in the database
  return Math.round(qty * 1000) / 1000;
}

function parseUnit(value: unknown): string {
  const unit = typeof value === "string" ? value.trim() : "";
  if (!unit) return "ea";
  if (unit.length > MAX_UNIT) {
    throw new JobMaterialValidationError(`Unit must be ${MAX_UNIT} characters or fewer.`);
  }
  return unit;
}

function parsePartNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new JobMaterialValidationError("Part number must be text.");
  const part = value.trim();
  if (!part) return null;
  if (part.length > MAX_PART) {
    throw new JobMaterialValidationError(`Part number must be ${MAX_PART} characters or fewer.`);
  }
  return part;
}

function parseNotes(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new JobMaterialValidationError("Notes must be text.");
  const notes = value.trim();
  if (notes.length > MAX_NOTES) {
    throw new JobMaterialValidationError(`Notes must be ${MAX_NOTES} characters or fewer.`);
  }
  return notes;
}

function parseState(value: unknown): JobMaterialState {
  if (!isJobMaterialState(value)) {
    throw new JobMaterialValidationError("state must be needed, on_truck, or used.");
  }
  return value;
}

export function parseJobMaterialCreate(body: Record<string, unknown>): JobMaterialCreateInput {
  return {
    name: parseName(body.name),
    quantity: body.quantity === undefined ? 1 : parseQuantity(body.quantity),
    unit: parseUnit(body.unit),
    partNumber: parsePartNumber(body.partNumber),
    notes: parseNotes(body.notes),
    state: body.state === undefined ? "needed" : parseState(body.state),
  };
}

const PATCH_KEYS = new Set(["name", "quantity", "unit", "partNumber", "notes", "state"]);

export function parseJobMaterialPatch(body: Record<string, unknown>): JobMaterialPatchInput {
  const patch: JobMaterialPatchInput = {};
  for (const key of Object.keys(body)) {
    if (!PATCH_KEYS.has(key)) {
      throw new JobMaterialValidationError(`Unknown field: ${key}.`);
    }
  }
  if ("name" in body) patch.name = parseName(body.name);
  if ("quantity" in body) patch.quantity = parseQuantity(body.quantity);
  if ("unit" in body) patch.unit = parseUnit(body.unit);
  if ("partNumber" in body) patch.partNumber = parsePartNumber(body.partNumber);
  if ("notes" in body) patch.notes = parseNotes(body.notes);
  if ("state" in body) patch.state = parseState(body.state);
  if (Object.keys(patch).length === 0) {
    throw new JobMaterialValidationError("Nothing to update.");
  }
  return patch;
}

// ------------------------------------------------------------------
// Summary + Dispatch readiness
// ------------------------------------------------------------------

export function emptyJobMaterialSummary(): JobMaterialSummary {
  return { total: 0, needed: 0, onTruck: 0, used: 0 };
}

export function summarizeJobMaterialStates(
  states: Iterable<JobMaterialState>,
): JobMaterialSummary {
  const summary = emptyJobMaterialSummary();
  for (const state of states) {
    summary.total += 1;
    if (state === "needed") summary.needed += 1;
    else if (state === "on_truck") summary.onTruck += 1;
    else if (state === "used") summary.used += 1;
  }
  return summary;
}

export function summarizeJobMaterials(lines: ReadonlyArray<Pick<JobMaterialLine, "state">>) {
  return summarizeJobMaterialStates(lines.map((line) => line.state));
}

/**
 * Dispatch "Materials" chip:
 *   no list yet            → attention (amber) — someone should look
 *   anything still needed  → not satisfied (red) — truck isn't loaded
 *   all on truck / used    → satisfied (green)
 */
export function materialReadinessFromSummary(summary: JobMaterialSummary): MaterialReadiness {
  if (summary.total === 0) {
    return { state: "attention_needed", reason: "No materials list yet" };
  }
  if (summary.needed > 0) {
    return {
      state: "not_satisfied",
      reason: `${summary.needed} of ${summary.total} still needed`,
    };
  }
  if (summary.used === summary.total) {
    return { state: "satisfied", reason: "All materials used" };
  }
  return { state: "satisfied", reason: "All materials on the truck" };
}

/** Next state for the one-tap advance button. `used` stays `used`. */
export function nextJobMaterialState(state: JobMaterialState): JobMaterialState {
  if (state === "needed") return "on_truck";
  return "used";
}

/** "2 ea", "12.5 ft" — drops trailing zeros from numeric(12,3). */
export function formatMaterialQuantity(quantity: number, unit: string): string {
  const qty = Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(3)));
  return `${qty} ${unit}`.trim();
}
