import { describe, it, expect } from "vitest";

import { ROUTES } from "@/lib/routes";

/**
 * Regression tests to ensure the contractors MVP addition did not
 * break any existing ROUTES constants and that the new route is correct.
 */
describe("ROUTES — no regression from contractors MVP addition", () => {
  it("ROUTES.DASHBOARD is /dashboard", () => {
    expect(ROUTES.DASHBOARD).toBe("/dashboard");
  });

  it("ROUTES.JOBS is /jobs", () => {
    expect(ROUTES.JOBS).toBe("/jobs");
  });

  it("ROUTES.PROPERTIES is /properties", () => {
    expect(ROUTES.PROPERTIES).toBe("/properties");
  });

  it("ROUTES.CUSTOMERS is /customers", () => {
    expect(ROUTES.CUSTOMERS).toBe("/customers");
  });

  it("ROUTES.CONTRACTORS is /contractors", () => {
    expect(ROUTES.CONTRACTORS).toBe("/contractors");
  });

  it("ROUTES.HOME is /", () => {
    expect(ROUTES.HOME).toBe("/");
  });
});
