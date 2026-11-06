import { MATERIAL_EVENT_TYPES, type MaterialEventInput, type MaterialEventType } from "../types/pulls";

import { isUuid, type RuleResult } from "./kitRules";

export const MATERIAL_EVENT_NOTE_MAX = 1000;
const MAX_QTY = 999_999;

function fail<T>(message: string): RuleResult<T> {
  return { ok: false, message };
}

function isEventType(value: unknown): value is MaterialEventType {
  return typeof value === "string" && (MATERIAL_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * A field event: what went wrong or changed on a job's materials. It needs a type and
 * something to point at (a line, an item) or a note. No costs are accepted or stored.
 */
export function validateMaterialEvent(body: Record<string, unknown>): RuleResult<MaterialEventInput> {
  if (!isEventType(body.eventType)) return fail("Choose what happened.");

  const lineId = body.lineId === undefined || body.lineId === null || body.lineId === "" ? null : body.lineId;
  if (lineId !== null && !isUuid(lineId)) return fail("Pick a line from the list.");
  const itemId = body.itemId === undefined || body.itemId === null || body.itemId === "" ? null : body.itemId;
  if (itemId !== null && !isUuid(itemId)) return fail("Pick an item from the list.");

  let qty: number | null = null;
  if (body.qty !== undefined && body.qty !== null && body.qty !== "") {
    const parsed = typeof body.qty === "string" ? Number(body.qty) : body.qty;
    if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_QTY) {
      return fail("Quantity must be more than zero.");
    }
    if (Math.abs(parsed * 1000 - Math.round(parsed * 1000)) > 1e-6) {
      return fail("Quantity can have at most 3 decimal places.");
    }
    qty = parsed;
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") return fail("The note must be text.");
    const trimmed = body.note.trim();
    if (trimmed.length > MATERIAL_EVENT_NOTE_MAX) {
      return fail(`The note can be at most ${MATERIAL_EVENT_NOTE_MAX} characters.`);
    }
    note = trimmed === "" ? null : trimmed;
  }

  if (lineId === null && itemId === null && note === null) {
    return fail("Say which line or item it was about, or add a note.");
  }
  return { ok: true, value: { eventType: body.eventType, lineId, itemId, qty, note } };
}
