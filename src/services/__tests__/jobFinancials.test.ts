import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getJobByIdMock, readRowsMock } = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  readRowsMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({ getJobById: getJobByIdMock }));
vi.mock("@/repositories/jobFinancials", () => ({
  readJobFinancialRows: readRowsMock,
}));
// No stored setting in tests -> visibility defaults to "owner".
vi.mock("@/repositories/orgSettings", () => ({
  readOrgSetting: vi.fn(async () => null),
  writeOrgSetting: vi.fn(async () => {}),
}));

import {
  canSeeJobFinancials,
  composeJobFinancials,
  getJobFinancialsForRole,
} from "../jobFinancials";
import type { JobFinancialRows } from "@/repositories/jobFinancials";

const ROWS: JobFinancialRows = {
  totalCents: 22622,
  lineItems: [
    {
      kind: "service",
      name: "Maintenance - Heat Pump",
      description: null,
      qty: 1,
      rateCents: 20500,
      totalCents: 20500,
      isDiscount: false,
    },
    {
      kind: "other_charge",
      name: "Tax",
      description: null,
      qty: 1,
      rateCents: null,
      totalCents: 2122,
      isDiscount: false,
    },
  ],
  invoices: [
    {
      id: "inv-1",
      number: "6754",
      invoiceDate: "2025-10-03",
      totalCents: 22622,
      isPaid: true,
      terms: "NET 20",
      poNumber: null,
    },
  ],
  payments: [
    {
      amountCents: 22622,
      receivedOn: "2025-10-15",
      paymentType: "Check",
      referenceNumber: null,
      memo: null,
      invoiceId: "inv-1",
    },
  ],
};

describe("composeJobFinancials", () => {
  it("composes the reconciled picture (line items = total = invoice = payment)", () => {
    const out = composeJobFinancials(ROWS);
    expect(out.summary).toEqual({
      totalCents: 22622,
      invoicedCents: 22622,
      paidCents: 22622,
      balanceCents: 0,
      hasImportedDetail: true,
    });
    expect(out.invoices[0].paidAppliedCents).toBe(22622);
    expect(out.invoices[0].flagMismatch).toBe(false);
    expect(out.payments[0].invoiceNumber).toBe("6754");
  });

  it("flags an invoice marked paid with no payments behind it", () => {
    const out = composeJobFinancials({ ...ROWS, payments: [] });
    expect(out.invoices[0].flagMismatch).toBe(true);
    expect(out.summary.balanceCents).toBe(22622);
  });

  it("flags an invoice marked open that payments fully cover", () => {
    const rows = {
      ...ROWS,
      invoices: [{ ...ROWS.invoices[0], isPaid: false }],
    };
    const out = composeJobFinancials(rows);
    expect(out.invoices[0].flagMismatch).toBe(true);
  });

  it("falls back to the job total for balance when no invoice was imported", () => {
    const out = composeJobFinancials({ ...ROWS, invoices: [], payments: [] });
    expect(out.summary.balanceCents).toBe(22622);
    expect(out.summary.hasImportedDetail).toBe(true); // line items still exist
  });

  it("reports no imported detail for a LOOP-native job", () => {
    const out = composeJobFinancials({
      totalCents: null,
      lineItems: [],
      invoices: [],
      payments: [],
    });
    expect(out.summary.hasImportedDetail).toBe(false);
    expect(out.summary.balanceCents).toBe(0);
  });
});

describe("owner-only gate", () => {
  beforeEach(() => {
    getJobByIdMock.mockReset();
    readRowsMock.mockReset();
  });

  it("allows only the owner role at the default visibility", () => {
    expect(canSeeJobFinancials("owner", "owner")).toBe(true);
    for (const role of ["manager", "office", "dispatch", "tech", "sales", null]) {
      expect(canSeeJobFinancials(role, "owner")).toBe(false);
    }
  });

  it("follows the visibility setting when the owner loosens it", () => {
    expect(canSeeJobFinancials("manager", "owner_manager")).toBe(true);
    expect(canSeeJobFinancials("office", "owner_manager")).toBe(false);
    expect(canSeeJobFinancials("office", "revenue_roles")).toBe(true);
    expect(canSeeJobFinancials("tech", "revenue_roles")).toBe(false);
  });

  it("rejects non-owners before touching the database", async () => {
    await expect(
      // @ts-expect-error testing a non-owner role string
      getJobFinancialsForRole("office", "job-1"),
    ).rejects.toMatchObject({ status: 403 });
    expect(getJobByIdMock).not.toHaveBeenCalled();
    expect(readRowsMock).not.toHaveBeenCalled();
  });

  it("404s for the owner when the job does not exist", async () => {
    getJobByIdMock.mockResolvedValue(null);
    await expect(getJobFinancialsForRole("owner", "nope")).rejects.toMatchObject({
      status: 404,
    });
  });
});
