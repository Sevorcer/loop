/**
 * Shared callback definitions (src/lib/callbacks.ts).
 *
 * These predicates are the ONE definition of "callback" used by every surface
 * (Dashboard, Command Center, Jobs list). The fixture below mirrors the shape
 * of the live disagreement that motivated this work: many callbacks all-time,
 * only a few open, plus a decoy Service job whose TITLE contains "callback"
 * (which must never be counted as a callback).
 */

import { describe, expect, it } from "vitest";

import {
  CALLBACK_LABELS,
  CALLBACK_TYPE,
  CALLBACK_TYPE_QUERY_VARIANTS,
  isCallbackJob,
  isCallbackType,
  isOpenCallbackJob,
} from "@/lib/callbacks";

type J = { type: string; status: string; title?: string };

// 7 callbacks total (all-time); 3 of them open. One decoy Service job titled
// "Callback follow-up" that must NOT count. One lowercase "callback" type.
const JOBS: J[] = [
  { type: "Callback", status: "Scheduled", title: "A" },
  { type: "Callback", status: "In Progress", title: "B" },
  { type: "callback", status: "On Hold", title: "C" }, // lowercase variant, open
  { type: "Callback", status: "Completed", title: "D" },
  { type: "Callback", status: "Completed", title: "E" },
  { type: "Callback", status: "Cancelled", title: "F" },
  { type: "Callback", status: "cancelled", title: "G" },
  { type: "Service", status: "Scheduled", title: "Callback follow-up" }, // decoy
  { type: "Install", status: "Scheduled", title: "New system" },
];

describe("callback definitions", () => {
  it("classifies by TYPE, case/whitespace insensitive, never by title text", () => {
    expect(isCallbackType("Callback")).toBe(true);
    expect(isCallbackType("callback")).toBe(true);
    expect(isCallbackType("  CALLBACK  ")).toBe(true);
    expect(isCallbackType("Service")).toBe(false);
    expect(isCallbackType(null)).toBe(false);
    // Title text is irrelevant: the decoy is a Service job.
    expect(isCallbackJob({ type: "Service" })).toBe(false);
  });

  it("'all callbacks' = every job of type Callback", () => {
    expect(JOBS.filter(isCallbackJob)).toHaveLength(7);
  });

  it("'open callbacks' = type Callback AND status not Completed/Cancelled", () => {
    const open = JOBS.filter(isOpenCallbackJob);
    expect(open).toHaveLength(3);
    expect(open.map((j) => j.title)).toEqual(["A", "B", "C"]);
  });

  it("open callbacks is a subset of all callbacks", () => {
    const all = new Set(JOBS.filter(isCallbackJob).map((j) => j.title));
    for (const j of JOBS.filter(isOpenCallbackJob)) {
      expect(all.has(j.title!)).toBe(true);
    }
  });

  it("exposes the canonical type and query variants used by server counts", () => {
    expect(CALLBACK_TYPE).toBe("Callback");
    expect(CALLBACK_TYPE_QUERY_VARIANTS).toEqual(["Callback", "callback"]);
  });

  it("provides distinct, self-explaining labels for each surface", () => {
    expect(CALLBACK_LABELS.open).toBe("Open callbacks");
    expect(CALLBACK_LABELS.all).toBe("Callbacks (all time)");
    expect(CALLBACK_LABELS.open).not.toBe(CALLBACK_LABELS.all);
  });
});
