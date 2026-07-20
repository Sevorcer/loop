import { describe, expect, it } from "vitest";

import { ROUTE_BUILDERS } from "@/lib/routes";

describe("ROUTE_BUILDERS", () => {
  it("builds canonical job detail route", () => {
    expect(ROUTE_BUILDERS.JOB_DETAIL("job-123")).toBe("/jobs/job-123");
  });

  it("builds canonical property detail route", () => {
    expect(ROUTE_BUILDERS.PROPERTY_DETAIL("prop-123")).toBe("/properties/prop-123");
  });

  it("builds canonical installed system detail route", () => {
    expect(ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL("sys-123")).toBe("/installed-systems/sys-123");
  });
});
