import { describe, expect, it } from "vitest";

import { formatCentsAsUsd, parseDollarsToCents } from "../money";

describe("parseDollarsToCents", () => {
  it("accepts dollars and cents and stores integer cents", () => {
    expect(parseDollarsToCents("1200.50")).toEqual({ ok: true, cents: 120050 });
    expect(parseDollarsToCents("$1,200.5")).toEqual({ ok: true, cents: 120050 });
    expect(parseDollarsToCents("0")).toEqual({ ok: true, cents: 0 });
    expect(parseDollarsToCents("  10 ")).toEqual({ ok: true, cents: 1000 });
  });

  it("treats a blank value as clearing the price", () => {
    expect(parseDollarsToCents("")).toEqual({ ok: true, cents: null });
    expect(parseDollarsToCents("   ")).toEqual({ ok: true, cents: null });
  });

  it("rejects negative amounts and extra decimal places", () => {
    expect(parseDollarsToCents("-5").ok).toBe(false);
    expect(parseDollarsToCents("10.555").ok).toBe(false);
    expect(parseDollarsToCents("12.5.0").ok).toBe(false);
    expect(parseDollarsToCents("free").ok).toBe(false);
  });
});

describe("formatCentsAsUsd", () => {
  it("formats cents as currency", () => {
    expect(formatCentsAsUsd(120050)).toBe("$1,200.50");
    expect(formatCentsAsUsd(0)).toBe("$0.00");
    expect(formatCentsAsUsd(null)).toBe("Not recorded");
  });
});
