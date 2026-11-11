import { describe, expect, it } from "vitest";

import type { SerialReviewRow } from "../types/serials";
import {
  checkReceiveSerials,
  checkSerialInput,
  groupReviewRows,
  isPlaceholderSerial,
  MAX_RECEIVE_SERIALS,
  MAX_SERIAL_LENGTH,
  normalizeSerial,
  parseReviewCommand,
  parseSerialList,
  PLACEHOLDER_SERIALS,
  replaceSerialInList,
  serialKey,
  systemSerialsFromUnits,
} from "../utils/serialRules";

describe("normalizeSerial and serialKey", () => {
  it("trims, keeps case and inner spacing, and tolerates null", () => {
    expect(normalizeSerial("  5603B 08941 ")).toBe("5603B 08941");
    expect(normalizeSerial(null)).toBe("");
    expect(normalizeSerial(undefined)).toBe("");
  });

  it("compares serials by trimmed lower-case key, like the database", () => {
    expect(serialKey("  SN-100 ")).toBe("sn-100");
    expect(serialKey("SN-100")).toBe(serialKey("sn-100"));
  });
});

describe("isPlaceholderSerial", () => {
  it("treats blanks, short values and the stand-in list as placeholders", () => {
    for (const value of ["", "  ", "12", "ab", "unknown", "UNKNOWN", " N/A ", "na", "none", "no tag"]) {
      expect(isPlaceholderSerial(value)).toBe(true);
    }
    expect(isPlaceholderSerial(null)).toBe(true);
    expect(isPlaceholderSerial(undefined)).toBe(true);
  });

  it("accepts real serials, including short real ones of three or more characters", () => {
    for (const value of ["SN-100", "3520-278-0001", "1ka03600xwap09pbvpl0163", "abc"]) {
      expect(isPlaceholderSerial(value)).toBe(false);
    }
  });

  it("pins the placeholder list that the database function mirrors", () => {
    expect([...PLACEHOLDER_SERIALS].sort()).toEqual(
      [
        "illegible",
        "missing",
        "n.a.",
        "n/a",
        "na",
        "no serial",
        "no tag",
        "none",
        "not available",
        "not readable",
        "not visible",
        "null",
        "tbd",
        "unk",
        "unknown",
        "unreadable",
      ].sort(),
    );
  });
});

describe("checkSerialInput", () => {
  it("returns the trimmed serial", () => {
    expect(checkSerialInput("  SN-100 ")).toEqual({ ok: true, serial: "SN-100" });
  });

  it("rejects non-text, blank, placeholder and over-long values", () => {
    expect(checkSerialInput(undefined)).toEqual({ ok: false, message: "serialNumber is required." });
    expect(checkSerialInput(42)).toEqual({ ok: false, message: "serialNumber is required." });
    expect(checkSerialInput("   ")).toEqual({ ok: false, message: "serialNumber is required." });
    expect(checkSerialInput("unknown").ok).toBe(false);
    expect(checkSerialInput("x".repeat(MAX_SERIAL_LENGTH + 1)).ok).toBe(false);
    expect(checkSerialInput("x".repeat(MAX_SERIAL_LENGTH)).ok).toBe(true);
  });
});

describe("replaceSerialInList", () => {
  it("replaces in place, matching by key", () => {
    expect(replaceSerialInList(["A-100", "B-200"], "a-100", "A-101")).toEqual(["A-101", "B-200"]);
  });

  it("removes when the replacement is null and leaves placeholders alone", () => {
    expect(replaceSerialInList(["unknown", "A-100"], "A-100", null)).toEqual(["unknown"]);
  });

  it("does not repeat a serial that the list already holds", () => {
    expect(replaceSerialInList(["A-100", "B-200"], "A-100", "B-200")).toEqual(["B-200"]);
    expect(replaceSerialInList(["A-100", "a-100"], "A-100", null)).toEqual([]);
  });

  it("appends the replacement when the old serial is not in the list", () => {
    expect(replaceSerialInList(["B-200"], "A-100", "A-101")).toEqual(["B-200", "A-101"]);
  });

  it("returns a new array and never mutates the input", () => {
    const input = ["A-100"];
    const out = replaceSerialInList(input, "A-100", "A-101");
    expect(input).toEqual(["A-100"]);
    expect(out).not.toBe(input);
  });
});

describe("parseReviewCommand", () => {
  it("accepts scrap without a serial", () => {
    expect(parseReviewCommand({ action: "scrap", serialNumber: "ignored" })).toEqual({ ok: true, command: { action: "scrap" } });
  });

  it("accepts keep and remove without a serial", () => {
    expect(parseReviewCommand({ action: "keep" })).toEqual({ ok: true, command: { action: "keep" } });
    expect(parseReviewCommand({ action: "remove", serialNumber: "ignored" })).toEqual({
      ok: true,
      command: { action: "remove" },
    });
  });

  it("requires a real serial to correct", () => {
    expect(parseReviewCommand({ action: "correct", serialNumber: " SN-200 " })).toEqual({
      ok: true,
      command: { action: "correct", serialNumber: "SN-200" },
    });
    expect(parseReviewCommand({ action: "correct" }).ok).toBe(false);
    expect(parseReviewCommand({ action: "correct", serialNumber: "n/a" }).ok).toBe(false);
  });

  it("rejects unknown actions and non-objects", () => {
    expect(parseReviewCommand({ action: "merge" })).toEqual({
      ok: false,
      message: "action must be keep, correct, remove or scrap.",
    });
    expect(parseReviewCommand(null).ok).toBe(false);
    expect(parseReviewCommand("keep").ok).toBe(false);
  });
});

describe("groupReviewRows", () => {
  const dup = (unit: string, system: string, manufacturer: string, serial: string): SerialReviewRow => ({
    reason: "duplicate_serial",
    serialUnitId: unit,
    installedSystemId: system,
    manufacturer,
    modelNumber: "M",
    serialNumber: serial,
  });
  const missing = (system: string, manufacturer: string): SerialReviewRow => ({
    reason: "missing_serial",
    serialUnitId: null,
    installedSystemId: system,
    manufacturer,
    modelNumber: "M",
    serialNumber: null,
  });

  it("groups duplicates by manufacturer and serial key, ignoring case and spacing", () => {
    const groups = groupReviewRows([
      dup("u1", "s1", "Bosch", "DUP-1"),
      dup("u2", "s2", "bosch ", "dup-1"),
      dup("u3", "s3", "Bosch", "OTHER-1"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows.map((r) => r.serialUnitId)).toEqual(["u1", "u2"]);
  });

  it("keeps missing serials one row each and lists duplicate groups first, largest first", () => {
    const groups = groupReviewRows([
      missing("s9", "Lennox"),
      dup("u1", "s1", "Bosch", "A-1"),
      dup("u2", "s2", "Bosch", "A-1"),
      dup("u3", "s3", "Carrier", "B-1"),
      dup("u4", "s4", "Carrier", "B-1"),
      dup("u5", "s5", "Carrier", "B-1"),
      missing("s10", "Lennox"),
    ]);
    expect(groups.map((g) => [g.reason, g.rows.length])).toEqual([
      ["duplicate_serial", 3],
      ["duplicate_serial", 2],
      ["missing_serial", 1],
      ["missing_serial", 1],
    ]);
  });

  it("lists detached units one row each, between duplicate groups and missing serials", () => {
    const detached = (id: string): SerialReviewRow => ({
      reason: "detached_unit",
      serialUnitId: id,
      installedSystemId: null,
      manufacturer: "Bosch",
      modelNumber: "M",
      serialNumber: `D-${id}`,
    });
    const groups = groupReviewRows([missing("s9", "Lennox"), detached("d1"), detached("d2"), dup("u1", "s1", "Bosch", "A-1"), dup("u2", "s2", "Bosch", "A-1")]);
    expect(groups.map((g) => [g.reason, g.rows.length])).toEqual([
      ["duplicate_serial", 2],
      ["detached_unit", 1],
      ["detached_unit", 1],
      ["missing_serial", 1],
    ]);
  });

  it("returns no groups for no rows", () => {
    expect(groupReviewRows([])).toEqual([]);
  });
});

describe("parseSerialList", () => {
  it("splits on lines, commas and semicolons, trims, and drops blanks", () => {
    expect(parseSerialList(" SN-1 \nSN-2,SN-3;\r\n\n  ,SN-4")).toEqual(["SN-1", "SN-2", "SN-3", "SN-4"]);
    expect(parseSerialList("  \n ")).toEqual([]);
  });
});

describe("checkReceiveSerials", () => {
  it("accepts real, distinct serials and returns them trimmed", () => {
    expect(checkReceiveSerials([" SN-0001 ", "SN-0002"])).toEqual({ ok: true, serials: ["SN-0001", "SN-0002"] });
  });

  it("needs at least one serial and not too many", () => {
    expect(checkReceiveSerials([]).ok).toBe(false);
    expect(checkReceiveSerials(undefined).ok).toBe(false);
    expect(checkReceiveSerials(Array.from({ length: MAX_RECEIVE_SERIALS + 1 }, (_, i) => `SN-${i}0000`)).ok).toBe(false);
  });

  it("names the entry that is a placeholder, too long or repeated, and never drops it silently", () => {
    const placeholder = checkReceiveSerials(["SN-0001", "N/A"]);
    expect(placeholder.ok).toBe(false);
    expect(!placeholder.ok && placeholder.message).toContain("N/A");
    expect(checkReceiveSerials(["x".repeat(MAX_SERIAL_LENGTH + 1)]).ok).toBe(false);
    const repeat = checkReceiveSerials(["SN-0001", "sn-0001"]);
    expect(repeat.ok).toBe(false);
    expect(!repeat.ok && repeat.message).toContain("more than once");
    expect(checkReceiveSerials([42]).ok).toBe(false);
  });
});

describe("systemSerialsFromUnits", () => {
  const unit = (serialNumber: string, createdAt: string, id = serialNumber) => ({ serialNumber, createdAt, id });

  it("lists unit serials in creation order and ignores the mirrored list for real serials", () => {
    expect(systemSerialsFromUnits([unit("B", "2026-02-01"), unit("A", "2026-01-01")], ["STALE-ONE"])).toEqual(["A", "B"]);
  });

  it("keeps placeholder entries that only the mirrored list has, once", () => {
    expect(systemSerialsFromUnits([unit("A", "2026-01-01")], ["unknown", "UNKNOWN", "A"])).toEqual(["A", "unknown"]);
  });

  it("falls back to placeholders only when there are no units", () => {
    expect(systemSerialsFromUnits([], ["unknown", "REAL-ONLY-IN-ARRAY"])).toEqual(["unknown"]);
    expect(systemSerialsFromUnits([])).toEqual([]);
  });
});
