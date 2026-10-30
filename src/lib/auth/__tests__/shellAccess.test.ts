import { describe, expect, it } from "vitest";

import { isTechDeniedApiPath, isTechDeniedPath, isTechJobEditorPath } from "../shellAccess";

describe("technician route guard", () => {
  it("blocks office screens and job editors", () => {
    expect(isTechDeniedPath("/dispatch")).toBe(true);
    expect(isTechDeniedPath("/dispatch/anything")).toBe(true);
    expect(isTechDeniedPath("/daily-plans")).toBe(true);
    expect(isTechDeniedPath("/customers")).toBe(true);
    expect(isTechDeniedPath("/customers/abc")).toBe(true);
    expect(isTechDeniedPath("/admin")).toBe(true);
    expect(isTechDeniedPath("/admin/organizations")).toBe(true);
    expect(isTechJobEditorPath("/jobs/new")).toBe(true);
    expect(isTechDeniedPath("/jobs/job-1/edit")).toBe(true);
  });

  it("leaves a technician's own work open", () => {
    expect(isTechDeniedPath("/jobs")).toBe(false);
    expect(isTechDeniedPath("/jobs/job-1")).toBe(false);
    expect(isTechDeniedPath("/installed-systems")).toBe(false);
    expect(isTechDeniedPath("/installed-systems/new")).toBe(false);
    expect(isTechDeniedPath("/calendar")).toBe(false);
    expect(isTechDeniedPath("/administrator")).toBe(false);
  });

  it("blocks the office APIs behind those screens", () => {
    expect(isTechDeniedApiPath("/api/dispatch")).toBe(true);
    expect(isTechDeniedApiPath("/api/dispatch-plans/plan-1")).toBe(true);
    expect(isTechDeniedApiPath("/api/daily-plans")).toBe(true);
    expect(isTechDeniedApiPath("/api/customers")).toBe(true);
    expect(isTechDeniedApiPath("/api/jobs")).toBe(false);
    expect(isTechDeniedApiPath("/api/jobs/job-1")).toBe(false);
  });
});
