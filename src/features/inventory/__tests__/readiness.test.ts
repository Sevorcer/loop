import { describe, expect, it } from "vitest";

import type {
  ExpectedArrivalInput,
  ReadinessJobInput,
  ReadinessLineInput,
} from "../types/readiness";
import {
  computeReadiness,
  daysBetween,
  formatQty,
  shiftDate,
  shortDate,
  toDispatchReadiness,
  worstReadiness,
} from "../utils/readiness";

const TODAY = "2026-11-05";
const SETTINGS = { leadDays: 3, bufferDays: 1 };

function line(overrides: Partial<ReadinessLineInput> = {}): ReadinessLineInput {
  return {
    lineId: "l1",
    name: "Whip",
    itemId: "item-whip",
    required: 4,
    reserved: 0,
    pulled: 0,
    isOptional: false,
    nonStockReason: null,
    itemStockable: true,
    ...overrides,
  };
}

function job(overrides: Partial<ReadinessJobInput> = {}): ReadinessJobInput {
  return { jobId: "j1", scheduledDate: "2026-11-20", active: true, lines: [line()], ...overrides };
}

function arrival(overrides: Partial<ExpectedArrivalInput> = {}): ExpectedArrivalInput {
  return { id: "a1", itemId: "item-whip", qty: 10, etaDate: "2026-11-10", forJobId: null, ...overrides };
}

function run(jobs: ReadinessJobInput[], arrivals: ExpectedArrivalInput[] = [], freeStock: Record<string, number> = {}) {
  return computeReadiness({ today: TODAY, settings: SETTINGS, jobs, arrivals, freeStock });
}

describe("readiness engine", () => {
  it("is ok when the line is fully reserved", () => {
    const result = run([job({ lines: [line({ reserved: 4 })] })]).get("j1");
    expect(result?.rollup).toBe("ok");
    expect(result?.lines[0].state).toBe("ok");
    expect(result?.reason).toBeNull();
  });

  it("counts pulled quantity as satisfied", () => {
    const result = run([job({ lines: [line({ reserved: 1, pulled: 3 })] })]).get("j1");
    expect(result?.rollup).toBe("ok");
  });

  it("is ok when unclaimed shop stock covers the shortfall (draft plans)", () => {
    const result = run([job()], [], { "item-whip": 4 }).get("j1");
    expect(result?.rollup).toBe("ok");
  });

  it("is arriving_in_time when an arrival lands before the buffer", () => {
    const result = run([job()], [arrival({ etaDate: "2026-11-19" })]).get("j1");
    expect(result?.rollup).toBe("arriving_in_time");
    expect(result?.eta).toBe("2026-11-19");
    expect(result?.lines[0].reason).toBe("Whip: arriving Nov 19");
  });

  it("does not count an arrival that lands inside the buffer day", () => {
    const result = run([job()], [arrival({ etaDate: "2026-11-20" })]).get("j1");
    expect(result?.rollup).toBe("at_risk");
    expect(result?.reason).toBe("Short 4 Whip — ETA Nov 20 is too close to the job date");
  });

  it("is at_risk when the only arrival is after the job date", () => {
    const result = run([job()], [arrival({ etaDate: "2026-11-25" })]).get("j1");
    expect(result?.rollup).toBe("at_risk");
    expect(result?.eta).toBe("2026-11-25");
    expect(result?.reason).toBe("Short 4 Whip — ETA Nov 25 is after the job date");
  });

  it("is short when nothing is on order and the job is beyond the lead window", () => {
    const result = run([job()]).get("j1");
    expect(result?.rollup).toBe("short");
    expect(result?.reason).toBe("Short 4 Whip — not yet ordered");
  });

  it("is at_risk when nothing is on order and the job is inside the lead window", () => {
    const result = run([job({ scheduledDate: "2026-11-07" })]).get("j1");
    expect(result?.rollup).toBe("at_risk");
    expect(result?.reason).toBe("Short 4 Whip — not ordered, job in 2 days");
  });

  it("says singular day and handles a job today", () => {
    expect(run([job({ scheduledDate: "2026-11-06" })]).get("j1")?.reason).toBe("Short 4 Whip — not ordered, job in 1 day");
    expect(run([job({ scheduledDate: TODAY })]).get("j1")?.reason).toBe("Short 4 Whip — not ordered, job is today or overdue");
  });

  it("never counts one arrival for two jobs: the earlier job gets it", () => {
    const early = job({ jobId: "early", scheduledDate: "2026-11-18", lines: [line({ lineId: "e1", required: 6 })] });
    const late = job({ jobId: "late", scheduledDate: "2026-11-22", lines: [line({ lineId: "l9", required: 6 })] });
    const result = run([late, early], [arrival({ qty: 8, etaDate: "2026-11-12" })]);
    expect(result.get("early")?.rollup).toBe("arriving_in_time");
    // 2 of 8 are left for the later job, which needs 6.
    expect(result.get("late")?.rollup).toBe("short");
    expect(result.get("late")?.lines[0].shortfall).toBe(4);
  });

  it("keeps a special order for its own job", () => {
    const a = job({ jobId: "a", scheduledDate: "2026-11-18" });
    const b = job({ jobId: "b", scheduledDate: "2026-11-22" });
    const result = run([a, b], [arrival({ qty: 4, etaDate: "2026-11-12", forJobId: "b" })]);
    expect(result.get("b")?.rollup).toBe("arriving_in_time");
    expect(result.get("a")?.rollup).toBe("short");
  });

  it("reports a needs-SKU line as unverified, not as a fifth state", () => {
    const result = run([job({ lines: [line({ itemId: null, name: "Misc fittings" })] })]).get("j1");
    expect(result?.lines[0].state).toBeNull();
    expect(result?.lines[0].unverified).toBe(true);
    expect(result?.counts.needsSku).toBe(1);
    expect(result?.rollup).toBe("ok");
    expect(result?.reason).toBe("1 line needs a catalog item");
    expect(toDispatchReadiness(result?.rollup ?? null, result?.counts.needsSku ?? 0)).toBe("attention_needed");
  });

  it("leaves optional, not-stock and non-stockable lines out", () => {
    const result = run([
      job({
        lines: [
          line({ lineId: "o", isOptional: true }),
          line({ lineId: "n", nonStockReason: "Bought on the day" }),
          line({ lineId: "s", itemStockable: false }),
        ],
      }),
    ]).get("j1");
    expect(result?.lines.map((l) => l.excluded)).toEqual([true, true, true]);
    expect(result?.counts.total).toBe(0);
    expect(result?.rollup).toBe("ok");
  });

  it("does not check unscheduled or inactive jobs", () => {
    const result = run([job({ jobId: "u", scheduledDate: null }), job({ jobId: "c", active: false })]);
    expect(result.get("u")?.rollup).toBeNull();
    expect(result.get("c")?.rollup).toBeNull();
  });

  it("rolls up to the worst line and counts the rest", () => {
    const result = run(
      [
        job({
          lines: [
            line({ lineId: "a", reserved: 4 }),
            line({ lineId: "b", name: "Pad", itemId: "item-pad", required: 1 }),
            line({ lineId: "c", name: "Pipe", itemId: "item-pipe", required: 2 }),
          ],
        }),
      ],
      [],
    ).get("j1");
    expect(result?.rollup).toBe("short");
    expect(result?.reason).toBe("Short 1 Pad — not yet ordered (+1 more)");
    expect(result?.counts).toEqual({ total: 3, ok: 1, arriving: 0, short: 2, atRisk: 0, needsSku: 0 });
  });
});

describe("readiness helpers", () => {
  it("ranks levels and ignores null", () => {
    expect(worstReadiness("ok", "short")).toBe("short");
    expect(worstReadiness("at_risk", "short")).toBe("at_risk");
    expect(worstReadiness(null, "arriving_in_time")).toBe("arriving_in_time");
    expect(worstReadiness(null, null)).toBeNull();
  });

  it("maps to the dispatch chip states", () => {
    expect(toDispatchReadiness("ok", 0)).toBe("satisfied");
    expect(toDispatchReadiness("arriving_in_time", 0)).toBe("attention_needed");
    expect(toDispatchReadiness("short", 0)).toBe("attention_needed");
    expect(toDispatchReadiness("at_risk", 0)).toBe("not_satisfied");
    expect(toDispatchReadiness("ok", 2)).toBe("attention_needed");
  });

  it("does date math without time zones", () => {
    expect(daysBetween("2026-11-05", "2026-11-08")).toBe(3);
    expect(daysBetween("2026-11-08", "2026-11-05")).toBe(-3);
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shortDate("2026-11-14")).toBe("Nov 14");
    expect(formatQty(2)).toBe("2");
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(1.2500001)).toBe("1.25");
  });
});
