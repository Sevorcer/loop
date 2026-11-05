import { describe, expect, it } from "vitest";

import type { LedgerEntry } from "../types/ledger";
import { expandLedgerCommand, isValidQty, LedgerRuleError } from "../utils/ledgerRules";

const ctx = { newTransferGroupId: () => "group-1" };

function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: "txn-1",
    txnType: "receive",
    itemId: "item-1",
    locationId: "loc-shop",
    qtyDelta: 10,
    jobId: null,
    transferGroupId: null,
    reversesTransactionId: null,
    reason: null,
    unitCostCents: null,
    createdBy: "user-1",
    createdAt: "2026-11-05T00:00:00Z",
    ...overrides,
  };
}

describe("isValidQty", () => {
  it("accepts positive numbers with up to 3 decimals", () => {
    expect(isValidQty(1)).toBe(true);
    expect(isValidQty(0.125)).toBe(true);
  });
  it("rejects zero, negatives, NaN, strings and 4 decimals", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "2", 0.0001]) {
      expect(isValidQty(bad)).toBe(false);
    }
  });
});

describe("expandLedgerCommand", () => {
  it("receive appends a positive row with cost", () => {
    const rows = expandLedgerCommand({ kind: "receive", itemId: "i", locationId: "l", qty: 10, unitCostCents: 250 }, ctx);
    expect(rows).toEqual([{ txnType: "receive", itemId: "i", locationId: "l", qtyDelta: 10, unitCostCents: 250, reason: null }]);
  });

  it("rejects non-positive receives", () => {
    expect(() => expandLedgerCommand({ kind: "receive", itemId: "i", locationId: "l", qty: 0 }, ctx)).toThrow(LedgerRuleError);
  });

  it("adjust is signed and requires a reason", () => {
    const rows = expandLedgerCommand({ kind: "adjust", itemId: "i", locationId: "l", qtyDelta: -2, reason: " broke " }, ctx);
    expect(rows[0]).toMatchObject({ txnType: "adjust", qtyDelta: -2, reason: "broke" });
    expect(() => expandLedgerCommand({ kind: "adjust", itemId: "i", locationId: "l", qtyDelta: 1, reason: " " }, ctx)).toThrow(LedgerRuleError);
    expect(() => expandLedgerCommand({ kind: "adjust", itemId: "i", locationId: "l", qtyDelta: 0, reason: "x" }, ctx)).toThrow(LedgerRuleError);
  });

  it("count posts the difference to on-hand, and nothing when equal", () => {
    const up = expandLedgerCommand({ kind: "count", itemId: "i", locationId: "l", countedQty: 12 }, { ...ctx, currentOnHand: 7 });
    expect(up[0]).toMatchObject({ txnType: "count", qtyDelta: 5, reason: "Physical count" });
    const down = expandLedgerCommand({ kind: "count", itemId: "i", locationId: "l", countedQty: 2 }, { ...ctx, currentOnHand: 7 });
    expect(down[0].qtyDelta).toBe(-5);
    expect(expandLedgerCommand({ kind: "count", itemId: "i", locationId: "l", countedQty: 7 }, { ...ctx, currentOnHand: 7 })).toEqual([]);
  });

  it("count can fix a negative on-hand without float noise", () => {
    const rows = expandLedgerCommand({ kind: "count", itemId: "i", locationId: "l", countedQty: 0.3 }, { ...ctx, currentOnHand: 0.1 });
    expect(rows[0].qtyDelta).toBe(0.2);
  });

  it("count needs the current on-hand", () => {
    expect(() => expandLedgerCommand({ kind: "count", itemId: "i", locationId: "l", countedQty: 1 }, ctx)).toThrow(LedgerRuleError);
  });

  it("transfer is a paired out/in sharing one group and netting to zero", () => {
    const rows = expandLedgerCommand({ kind: "transfer", itemId: "i", fromLocationId: "shop", toLocationId: "van", qty: 4 }, ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ txnType: "transfer_out", locationId: "shop", qtyDelta: -4, transferGroupId: "group-1" });
    expect(rows[1]).toMatchObject({ txnType: "transfer_in", locationId: "van", qtyDelta: 4, transferGroupId: "group-1" });
    expect(rows[0].qtyDelta + rows[1].qtyDelta).toBe(0);
  });

  it("transfer rejects the same location on both sides", () => {
    expect(() => expandLedgerCommand({ kind: "transfer", itemId: "i", fromLocationId: "a", toLocationId: "a", qty: 1 }, ctx)).toThrow(LedgerRuleError);
  });

  it("issue and return carry the job and opposite signs", () => {
    expect(expandLedgerCommand({ kind: "issue_to_job", itemId: "i", locationId: "l", jobId: "job-1", qty: 3 }, ctx)[0]).toMatchObject({
      txnType: "issue_to_job",
      qtyDelta: -3,
      jobId: "job-1",
    });
    expect(expandLedgerCommand({ kind: "return_from_job", itemId: "i", locationId: "l", jobId: "job-1", qty: 1 }, ctx)[0]).toMatchObject({
      txnType: "return_from_job",
      qtyDelta: 1,
    });
  });

  it("never lets an allowed command go negative-blocking: on-hand is not consulted", () => {
    expect(() => expandLedgerCommand({ kind: "issue_to_job", itemId: "i", locationId: "l", jobId: "j", qty: 9999 }, ctx)).not.toThrow();
  });

  it("reverse mirrors the original with the opposite quantity and a link back", () => {
    const rows = expandLedgerCommand({ kind: "reverse", transactionId: "txn-1", reason: "entered twice" }, { ...ctx, originals: [entry({})] });
    expect(rows).toEqual([
      {
        txnType: "reversal",
        itemId: "item-1",
        locationId: "loc-shop",
        qtyDelta: -10,
        jobId: null,
        reversesTransactionId: "txn-1",
        reason: "entered twice",
      },
    ]);
  });

  it("reversing one half of a transfer reverses both halves", () => {
    const out = entry({ id: "t-out", txnType: "transfer_out", locationId: "shop", qtyDelta: -4, transferGroupId: "g" });
    const inn = entry({ id: "t-in", txnType: "transfer_in", locationId: "van", qtyDelta: 4, transferGroupId: "g" });
    const rows = expandLedgerCommand({ kind: "reverse", transactionId: "t-out", reason: "wrong van" }, { ...ctx, originals: [out, inn] });
    expect(rows.map((r) => [r.locationId, r.qtyDelta, r.reversesTransactionId])).toEqual([
      ["shop", 4, "t-out"],
      ["van", -4, "t-in"],
    ]);
    expect(rows.every((r) => r.transferGroupId == null)).toBe(true);
  });

  it("requires a reason, the original, and refuses to reverse a reversal", () => {
    expect(() => expandLedgerCommand({ kind: "reverse", transactionId: "x", reason: "" }, { ...ctx, originals: [entry({})] })).toThrow(LedgerRuleError);
    expect(() => expandLedgerCommand({ kind: "reverse", transactionId: "x", reason: "r" }, ctx)).toThrow(LedgerRuleError);
    expect(() =>
      expandLedgerCommand({ kind: "reverse", transactionId: "x", reason: "r" }, { ...ctx, originals: [entry({ txnType: "reversal", reversesTransactionId: "y" })] }),
    ).toThrow(LedgerRuleError);
  });
});
