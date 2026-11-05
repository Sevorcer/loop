import { describe, expect, it } from "vitest";

import { sortInvoicesNewestFirst, summarizeInvoices } from "../utils/customerInvoices";

describe("summarizeInvoices", () => {
  it("splits paid from awaiting totals and counts", () => {
    expect(
      summarizeInvoices([
        { totalCents: 150000, isPaid: true },
        { totalCents: 25000, isPaid: false },
        { totalCents: 75050, isPaid: false },
        { totalCents: 10000, isPaid: true },
      ]),
    ).toEqual({ paidCents: 160000, outstandingCents: 100050, paidCount: 2, awaitingCount: 2 });
  });

  it("is all zeros for no invoices and ignores non-finite totals", () => {
    expect(summarizeInvoices([])).toEqual({ paidCents: 0, outstandingCents: 0, paidCount: 0, awaitingCount: 0 });
    expect(summarizeInvoices([{ totalCents: Number.NaN, isPaid: false }]).outstandingCents).toBe(0);
  });
});

describe("sortInvoicesNewestFirst", () => {
  it("orders by date descending, undated last, ties by invoice number descending", () => {
    const sorted = sortInvoicesNewestFirst([
      { number: "1001", invoiceDate: "2026-01-05T00:00:00Z" },
      { number: "1003", invoiceDate: null },
      { number: "1002", invoiceDate: "2026-03-01T00:00:00Z" },
      { number: "1010", invoiceDate: "2026-01-05T00:00:00Z" },
    ]);
    expect(sorted.map((row) => row.number)).toEqual(["1002", "1010", "1001", "1003"]);
  });

  it("does not mutate its input", () => {
    const input = [
      { number: "1", invoiceDate: "2026-01-01T00:00:00Z" },
      { number: "2", invoiceDate: "2026-02-01T00:00:00Z" },
    ];
    sortInvoicesNewestFirst(input);
    expect(input.map((row) => row.number)).toEqual(["1", "2"]);
  });
});
