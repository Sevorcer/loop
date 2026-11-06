import {
  ARRIVAL_BUFFER_DAYS_MAX,
  KIT_STATUSES,
  READINESS_LEAD_DAYS_MAX,
  type InventorySettingsPatch,
  type KitHeaderPatch,
  type KitLineInput,
  type KitStatus,
} from "../types/kits";

/**
 * Pure validation/normalisation for kit and settings payloads. Used by the
 * service (authoritative) and by the editor (to mirror the same limits), so the
 * rules live in one place. Nothing here touches I/O.
 */

export type RuleResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const KIT_NAME_MAX = 120;
export const KIT_DESCRIPTION_MAX = 1000;
export const KIT_CATEGORY_MAX = 60;
export const KIT_LINE_NOTES_MAX = 500;
export const KIT_MAX_LINES = 200;
export const KIT_MAX_QUANTITY = 999_999;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function fail<T>(message: string): RuleResult<T> {
  return { ok: false, message };
}

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Quantities are stored as numeric(12,3): reject more than 3 decimals instead of silently rounding. */
function hasAtMostThreeDecimals(value: number): boolean {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

export function validateKitName(raw: unknown): RuleResult<string> {
  if (typeof raw !== "string") return fail("Give the kit a name.");
  const name = raw.trim();
  if (!name) return fail("Give the kit a name.");
  if (name.length > KIT_NAME_MAX) return fail(`Kit names can be at most ${KIT_NAME_MAX} characters.`);
  return { ok: true, value: name };
}

/** Validates only the keys that are present, so PATCH can change one field at a time. */
export function normalizeKitHeader(input: Record<string, unknown>): RuleResult<KitHeaderPatch> {
  const patch: KitHeaderPatch = {};

  if ("name" in input) {
    const name = validateKitName(input.name);
    if (!name.ok) return name;
    patch.name = name.value;
  }
  if ("description" in input) {
    if (input.description !== null && typeof input.description !== "string") return fail("Description must be text.");
    const description = input.description === null ? null : cleanText(input.description);
    if (description && description.length > KIT_DESCRIPTION_MAX) {
      return fail(`Descriptions can be at most ${KIT_DESCRIPTION_MAX} characters.`);
    }
    patch.description = description;
  }
  if ("category" in input) {
    if (input.category !== null && typeof input.category !== "string") return fail("Category must be text.");
    const category = input.category === null ? null : cleanText(input.category);
    if (category && category.length > KIT_CATEGORY_MAX) {
      return fail(`Categories can be at most ${KIT_CATEGORY_MAX} characters.`);
    }
    patch.category = category;
  }
  if ("status" in input) {
    if (!KIT_STATUSES.includes(input.status as KitStatus)) return fail("Status must be active or archived.");
    patch.status = input.status as KitStatus;
  }
  return { ok: true, value: patch };
}

export function normalizeKitLines(input: unknown): RuleResult<KitLineInput[]> {
  if (!Array.isArray(input)) return fail("Kit lines must be a list.");
  if (input.length > KIT_MAX_LINES) return fail(`A kit can have at most ${KIT_MAX_LINES} lines.`);

  const seen = new Set<string>();
  const lines: KitLineInput[] = [];
  for (const [index, raw] of input.entries()) {
    const label = `Line ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(`${label} is not valid.`);
    const row = raw as Record<string, unknown>;

    if (!isUuid(row.catalogItemId)) return fail(`${label}: choose an item from the catalog.`);
    const key = row.catalogItemId.toLowerCase();
    if (seen.has(key)) return fail("An item can appear only once in a kit. Raise its quantity instead.");
    seen.add(key);

    if (typeof row.quantity !== "number" || !Number.isFinite(row.quantity) || row.quantity <= 0) {
      return fail(`${label}: quantity must be more than zero.`);
    }
    if (row.quantity > KIT_MAX_QUANTITY) return fail(`${label}: quantity is too large.`);
    if (!hasAtMostThreeDecimals(row.quantity)) return fail(`${label}: quantity can have at most 3 decimal places.`);

    if (row.isOptional !== undefined && typeof row.isOptional !== "boolean") {
      return fail(`${label}: optional must be true or false.`);
    }
    if (row.notes !== undefined && row.notes !== null && typeof row.notes !== "string") {
      return fail(`${label}: notes must be text.`);
    }
    const notes = typeof row.notes === "string" ? cleanText(row.notes) : null;
    if (notes && notes.length > KIT_LINE_NOTES_MAX) {
      return fail(`${label}: notes can be at most ${KIT_LINE_NOTES_MAX} characters.`);
    }

    lines.push({
      catalogItemId: row.catalogItemId,
      quantity: Math.round(row.quantity * 1000) / 1000,
      isOptional: row.isOptional === true,
      notes,
    });
  }
  return { ok: true, value: lines };
}

/**
 * True when two line lists carry the same content, ignoring order. This mirrors
 * the database rule that decides whether a save bumps the kit version.
 */
export function sameKitLines(a: readonly KitLineInput[], b: readonly KitLineInput[]): boolean {
  if (a.length !== b.length) return false;
  const byItem = new Map(a.map((line) => [line.catalogItemId.toLowerCase(), line]));
  return b.every((line) => {
    const other = byItem.get(line.catalogItemId.toLowerCase());
    return (
      other !== undefined &&
      other.quantity === line.quantity &&
      (other.isOptional ?? false) === (line.isOptional ?? false) &&
      (other.notes?.trim() || null) === (line.notes?.trim() || null)
    );
  });
}

export function normalizeSettingsPatch(input: Record<string, unknown>): RuleResult<InventorySettingsPatch> {
  const patch: InventorySettingsPatch = {};

  if ("closeoutEnforcement" in input) {
    return fail("The closeout enforcement stage is changed when closeout reconciliation ships, not before.");
  }
  if ("readinessLeadDays" in input) {
    const value = input.readinessLeadDays;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > READINESS_LEAD_DAYS_MAX) {
      return fail(`Lead days must be a whole number from 0 to ${READINESS_LEAD_DAYS_MAX}.`);
    }
    patch.readinessLeadDays = value;
  }
  if ("arrivalBufferDays" in input) {
    const value = input.arrivalBufferDays;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > ARRIVAL_BUFFER_DAYS_MAX) {
      return fail(`Arrival buffer must be a whole number from 0 to ${ARRIVAL_BUFFER_DAYS_MAX}.`);
    }
    patch.arrivalBufferDays = value;
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to change.");
  return { ok: true, value: patch };
}
