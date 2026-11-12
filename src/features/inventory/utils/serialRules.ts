/**
 * Pure serial rules (Inventory Lane 3). No I/O.
 *
 * PLACEHOLDER_SERIALS and MIN_SERIAL_LENGTH mirror fn_serial_is_placeholder in
 * supabase/migrations/20261128000000_inventory_serial_units.sql. Change both
 * together; serialRules.test.ts pins the list.
 */

import { RMA_ACTIONS, type RmaCommand } from "../types/serials";
import type {
  SerialReviewCommand,
  SerialReviewReason,
  SerialReviewRow,
} from "../types/serials";

export const MIN_SERIAL_LENGTH = 3;
export const MAX_SERIAL_LENGTH = 64;

export const PLACEHOLDER_SERIALS: ReadonlySet<string> = new Set([
  "unknown",
  "unk",
  "na",
  "n/a",
  "n.a.",
  "none",
  "null",
  "tbd",
  "not available",
  "not visible",
  "not readable",
  "unreadable",
  "illegible",
  "no serial",
  "no tag",
  "missing",
]);

/** Trims. Case and inner spacing are kept as typed. */
export function normalizeSerial(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** The identity used to compare serials: trimmed and lower-cased (matches serial_key in the database). */
export function serialKey(value: string | null | undefined): string {
  return normalizeSerial(value).toLowerCase();
}

/** True for blanks, very short values and known stand-ins such as "unknown" or "n/a". */
export function isPlaceholderSerial(value: string | null | undefined): boolean {
  const key = serialKey(value);
  return key.length < MIN_SERIAL_LENGTH || PLACEHOLDER_SERIALS.has(key);
}

export type SerialInputCheck = { ok: true; serial: string } | { ok: false; message: string };

/** Checks a serial a person typed or a scan proposed before it is saved. */
export function checkSerialInput(value: unknown): SerialInputCheck {
  if (typeof value !== "string") return { ok: false, message: "serialNumber is required." };
  const serial = normalizeSerial(value);
  if (!serial) return { ok: false, message: "serialNumber is required." };
  if (serial.length > MAX_SERIAL_LENGTH) {
    return { ok: false, message: `serialNumber must be ${MAX_SERIAL_LENGTH} characters or fewer.` };
  }
  if (isPlaceholderSerial(serial)) {
    return { ok: false, message: "That is not a real serial number. Enter what is printed on the nameplate." };
  }
  return { ok: true, serial };
}

/**
 * Replaces one serial in a system's serial list, matching by key. With a
 * replacement the new serial takes the old one's position; with null the
 * serial is removed. Other entries, including placeholders, are untouched,
 * and the result never repeats a serial.
 */
export function replaceSerialInList(
  list: readonly string[],
  oldSerial: string,
  replacement: string | null,
): string[] {
  const oldKey = serialKey(oldSerial);
  const next: string[] = [];
  const seen = new Set<string>();
  let placed = false;

  const push = (serial: string) => {
    const key = serialKey(serial);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(serial);
    }
  };

  for (const entry of list) {
    if (serialKey(entry) === oldKey) {
      if (replacement !== null && !placed) {
        push(replacement);
        placed = true;
      }
      continue;
    }
    push(entry);
  }
  if (replacement !== null && !placed) push(replacement);
  return next;
}

export type ReviewCommandCheck = { ok: true; command: SerialReviewCommand } | { ok: false; message: string };

/** Validates the body of a review command. "correct" needs a real serial; the others take none. */
export function parseReviewCommand(body: unknown): ReviewCommandCheck {
  if (!body || typeof body !== "object") return { ok: false, message: "action is required." };
  const { action, serialNumber } = body as { action?: unknown; serialNumber?: unknown };

  if (action === "keep" || action === "remove" || action === "scrap") {
    return { ok: true, command: { action } };
  }
  if (action === "correct") {
    const checked = checkSerialInput(serialNumber);
    if (!checked.ok) return checked;
    return { ok: true, command: { action, serialNumber: checked.serial } };
  }
  return { ok: false, message: "action must be keep, correct, remove or scrap." };
}

export interface ReviewGroup {
  key: string;
  reason: SerialReviewReason;
  manufacturer: string;
  serialNumber: string | null;
  rows: SerialReviewRow[];
}

/**
 * Groups review rows so the office sees one duplicate group at a time.
 * Duplicates group by manufacturer and serial key; missing serials stay one row each.
 */
const REASON_RANK: Record<SerialReviewReason, number> = { duplicate_serial: 0, detached_unit: 1, missing_serial: 2 };

export function groupReviewRows(rows: readonly SerialReviewRow[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const row of rows) {
    const key =
      row.reason === "duplicate_serial"
        ? `dup:${row.manufacturer.trim().toLowerCase()}:${serialKey(row.serialNumber)}`
        : row.reason === "detached_unit"
          ? `detached:${row.serialUnitId ?? groups.size}`
          : `missing:${row.installedSystemId ?? row.serialUnitId ?? groups.size}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, {
        key,
        reason: row.reason,
        manufacturer: row.manufacturer,
        serialNumber: row.serialNumber,
        rows: [row],
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      REASON_RANK[a.reason] - REASON_RANK[b.reason] ||
      b.rows.length - a.rows.length ||
      a.manufacturer.localeCompare(b.manufacturer),
  );
}

export function reviewReasonCopy(reason: SerialReviewReason): string {
  switch (reason) {
    case "duplicate_serial":
      return "This serial is on more than one system. Keep the right one and fix the others.";
    case "detached_unit":
      return "This unit was taken off its system and is in no stock location. Scrap it, or put its serial back on the right system.";
    default:
      return "This system has no usable serial. Add it from the nameplate.";
  }
}

/** Most serials accepted in one receipt; keeps a single request small and reviewable. */
export const MAX_RECEIVE_SERIALS = 200;

/** Splits what was typed or pasted (one per line, or separated by commas or semicolons) into serials. */
export function parseSerialList(text: string): string[] {
  return text
    .split(/[\n\r,;]+/)
    .map(normalizeSerial)
    .filter((serial) => serial.length > 0);
}

export type ReceiveSerialsCheck = { ok: true; serials: string[] } | { ok: false; message: string };

/**
 * Validates the serials for a receipt of a serialized item: at least one, each a real
 * serial, none repeated within the batch. Nothing is guessed or dropped.
 */
export function checkReceiveSerials(value: unknown): ReceiveSerialsCheck {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, message: "Enter at least one serial number." };
  }
  if (value.length > MAX_RECEIVE_SERIALS) {
    return { ok: false, message: `Receive at most ${MAX_RECEIVE_SERIALS} serial numbers at a time.` };
  }
  const serials: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const checked = checkSerialInput(entry);
    if (!checked.ok) {
      return { ok: false, message: typeof entry === "string" && entry.trim() ? `"${entry.trim()}": ${checked.message}` : checked.message };
    }
    const key = serialKey(checked.serial);
    if (seen.has(key)) return { ok: false, message: `"${checked.serial}" is listed more than once.` };
    seen.add(key);
    serials.push(checked.serial);
  }
  return { ok: true, serials };
}

/**
 * The serials to show for one installed system: its units are the source of truth,
 * in creation order. Placeholder entries ("unknown") that only exist on the mirrored
 * list are kept so the display and the edit form do not lose what someone typed.
 */
export function systemSerialsFromUnits(
  units: readonly { serialNumber: string; createdAt: string; id: string }[],
  mirroredList: readonly string[] = [],
): string[] {
  const ordered = [...units].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const serials = ordered.map((unit) => unit.serialNumber);
  const seen = new Set(serials.map(serialKey));
  for (const entry of mirroredList) {
    if (isPlaceholderSerial(entry) && !seen.has(serialKey(entry))) {
      seen.add(serialKey(entry));
      serials.push(entry);
    }
  }
  return serials;
}

export const RMA_NOTE_MAX = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RmaCommandCheck = { ok: true; command: RmaCommand } | { ok: false; message: string };

/**
 * Validates the body of an RMA command. repair needs the location the unit goes back to;
 * quarantine may name a quarantine location (otherwise the database picks or creates one);
 * return_to_supplier and scrap take none. The note is optional.
 */
export function parseRmaCommand(body: unknown): RmaCommandCheck {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, message: "action is required." };
  const { action, locationId, note } = body as { action?: unknown; locationId?: unknown; note?: unknown };

  if (typeof action !== "string" || !(RMA_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, message: "action must be quarantine, return_to_supplier, repair or scrap." };
  }

  let location: string | undefined;
  if (locationId !== undefined && locationId !== null && locationId !== "") {
    if (typeof locationId !== "string" || !UUID_PATTERN.test(locationId)) {
      return { ok: false, message: "locationId must be a location id." };
    }
    location = locationId;
  }
  if (action === "repair" && !location) {
    return { ok: false, message: "Choose the location the repaired unit goes back to." };
  }
  if ((action === "return_to_supplier" || action === "scrap") && location) {
    return { ok: false, message: "That action does not take a location." };
  }

  let text: string | undefined;
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") return { ok: false, message: "note must be text." };
    const trimmed = note.trim();
    if (trimmed.length > RMA_NOTE_MAX) {
      return { ok: false, message: `The note must be ${RMA_NOTE_MAX} characters or fewer.` };
    }
    if (trimmed) text = trimmed;
  }

  return {
    ok: true,
    command: {
      action: action as RmaCommand["action"],
      ...(location ? { locationId: location } : {}),
      ...(text ? { note: text } : {}),
    },
  };
}

/** What a unit can do next from its status; the buttons on the quarantine screen follow this. */
export function rmaActionsFor(status: string): RmaCommand["action"][] {
  if (status === "in_stock" || status === "installed") return ["quarantine"];
  if (status === "quarantine") return ["repair", "return_to_supplier", "scrap"];
  return [];
}
