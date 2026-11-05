import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCustomerByIdMock, listInvoicesForCustomersMock } = vi.hoisted(() => ({
  getCustomerByIdMock: vi.fn(),
  listInvoicesForCustomersMock: vi.fn(),
}));

vi.mock("@/repositories/customers", () => ({ getCustomerById: getCustomerByIdMock }));
vi.mock("@/repositories/customerInvoices", () => ({ listInvoicesForCustomers: listInvoicesForCustomersMock }));

import { getCustomerInvoices } from "@/services/customerInvoices";

beforeEach(() => vi.resetAllMocks());

describe("getCustomerInvoices", () => {
  it("returns null when the customer does not exist", async () => {
    getCustomerByIdMock.mockResolvedValue(null);
    expect(await getCustomerInvoices("missing")).toBeNull();
    expect(listInvoicesForCustomersMock).not.toHaveBeenCalled();
  });

  it("queries only the customer's own invoices when it has no child sites", async () => {
    getCustomerByIdMock.mockResolvedValue({ id: "c1", name: "Ada Homeowner", childCustomers: [] });
    listInvoicesForCustomersMock.mockResolvedValue([
      { id: "i1", totalCents: 10000, isPaid: true },
      { id: "i2", totalCents: 4000, isPaid: false },
    ]);

    const result = await getCustomerInvoices("c1");

    expect([...listInvoicesForCustomersMock.mock.calls[0][0].keys()]).toEqual(["c1"]);
    expect(result?.rolledUp).toBe(false);
    expect(result?.summary).toEqual({ paidCents: 10000, outstandingCents: 4000, paidCount: 1, awaitingCount: 1 });
  });

  it("rolls child job sites into a parent, like the Jobs tab", async () => {
    getCustomerByIdMock.mockResolvedValue({
      id: "p1",
      name: "McBride Homes",
      childCustomers: [
        { id: "k1", name: "McBride - Lot 4" },
        { id: "k2", name: "McBride - Lot 9" },
      ],
    });
    listInvoicesForCustomersMock.mockResolvedValue([]);

    const result = await getCustomerInvoices("p1");

    const scope = listInvoicesForCustomersMock.mock.calls[0][0] as Map<string, string>;
    expect([...scope.keys()]).toEqual(["p1", "k1", "k2"]);
    expect(scope.get("k1")).toBe("McBride - Lot 4");
    expect(result?.rolledUp).toBe(true);
  });
});
