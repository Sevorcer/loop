import type { ArrivalCreateInput, ArrivalPatch } from "../types/arrivals";

import { isUuid, type RuleResult } from "./kitRules";

export const ARRIVAL_NOTE_MAX = 500;
export const ARRIVAL_MAX_QTY = 999_999;

function fail<T>(message: string): RuleResult<T> {
  return { ok: false, message };
}

function hasAtMostThreeDecimals(value: number): boolean {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

/** A real calendar date in "YYYY-MM-DD" form. */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const probe = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    probe.getUTCFullYear() === Number(match[1]) &&
    probe.getUTCMonth() === Number(match[2]) - 1 &&
    probe.getUTCDate() === Number(match[3])
  );
}

function validateQty(raw: unknown): RuleResult<number> {
  const qty = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return fail("Quantity must be more than zero.");
  if (qty > ARRIVAL_MAX_QTY) return fail(`Quantity can be at most ${ARRIVAL_MAX_QTY}.`);
  if (!hasAtMostThreeDecimals(qty)) return fail("Quantity can have at most 3 decimal places.");
  return { ok: true, value: qty };
}

function validateNote(raw: unknown): RuleResult<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return fail("The note must be text.");
  const note = raw.trim();
  if (note.length > ARRIVAL_NOTE_MAX) return fail(`The note can be at most ${ARRIVAL_NOTE_MAX} characters.`);
  return { ok: true, value: note === "" ? null : note };
}

function validateJobId(raw: unknown): RuleResult<string | null> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  return isUuid(raw) ? { ok: true, value: raw } : fail("Pick a job from the list.");
}

export function validateArrivalCreate(body: Record<string, unknown>): RuleResult<ArrivalCreateInput> {
  if (!isUuid(body.itemId)) return fail("Pick the catalog item that is arriving.");
  const qty = validateQty(body.qty);
  if (!qty.ok) return qty;
  if (!isDateOnly(body.etaDate)) return fail("Enter the expected date.");
  const forJobId = validateJobId(body.forJobId);
  if (!forJobId.ok) return forJobId;
  const note = validateNote(body.supplierNote);
  if (!note.ok) return note;
  let locationId: string | null = null;
  if (body.locationId !== undefined && body.locationId !== null && body.locationId !== "") {
    if (!isUuid(body.locationId)) return fail("Pick a receiving location from the list.");
    locationId = body.locationId;
  }
  return {
    ok: true,
    value: { itemId: body.itemId, locationId, qty: qty.value, etaDate: body.etaDate, forJobId: forJobId.value, supplierNote: note.value },
  };
}

export function validateArrivalPatch(body: Record<string, unknown>): RuleResult<ArrivalPatch> {
  const patch: ArrivalPatch = {};
  if (body.cancel === true) patch.cancel = true;
  if (body.qty !== undefined) {
    const qty = validateQty(body.qty);
    if (!qty.ok) return qty;
    patch.qty = qty.value;
  }
  if (body.etaDate !== undefined) {
    if (!isDateOnly(body.etaDate)) return fail("Enter the expected date.");
    patch.etaDate = body.etaDate;
  }
  if (body.forJobId !== undefined) {
    const forJobId = validateJobId(body.forJobId);
    if (!forJobId.ok) return forJobId;
    patch.forJobId = forJobId.value;
  }
  if (body.supplierNote !== undefined) {
    const note = validateNote(body.supplierNote);
    if (!note.ok) return note;
    patch.supplierNote = note.value;
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to change.");
  return { ok: true, value: patch };
}
