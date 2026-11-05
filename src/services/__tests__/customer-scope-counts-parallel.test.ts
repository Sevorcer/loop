import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const listChildCustomerIds = vi.fn();
const countJobsForCustomers = vi.fn();

vi.mock("@/repositories/customers", async () => {
  const actual = await vi.importActual<typeof import("@/repositories/customers")>(
    "@/repositories/customers",
  );
  return {
    ...actual,
    listChildCustomerIds: (...args: unknown[]) => listChildCustomerIds(...args),
    countJobsForCustomers: (...args: unknown[]) => countJobsForCustomers(...args),
  };
});

import { getCustomerJobScopeCounts } from "@/services/customers";

describe("getCustomerJobScopeCounts parallelism", () => {
  beforeEach(() => {
    listChildCustomerIds.mockReset();
    countJobsForCustomers.mockReset();
  });

  it("runs own and across-account counts in parallel when there are children", async () => {
    const starts: string[] = [];
    listChildCustomerIds.mockResolvedValue(["child-1", "child-2"]);
    countJobsForCustomers.mockImplementation(async (ids: string[]) => {
      const label = ids.length === 1 ? "own" : "account";
      starts.push(`start:${label}`);
      await new Promise((r) => setTimeout(r, 20));
      starts.push(`end:${label}`);
      return ids.length === 1 ? 10 : 25;
    });

    const result = await getCustomerJobScopeCounts("parent-1");
    expect(result).toEqual({ own: 10, acrossAccount: 25, childCount: 2 });

    expect(starts.indexOf("start:account")).toBeLessThan(starts.indexOf("end:own"));
    expect(starts.indexOf("start:own")).toBeLessThan(starts.indexOf("end:account"));
  });
});
