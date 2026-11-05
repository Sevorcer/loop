import { describe, expect, it } from "vitest";

import {
  isRoleDeniedPath,
  isTechDeniedApiPath,
  isTechDeniedPath,
  isTechJobEditorPath,
} from "../shellAccess";

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
    expect(isTechDeniedApiPath("/api/dispatch-plans/plan-1")).toBe(true);
    expect(isTechDeniedApiPath("/api/daily-plans")).toBe(true);
    expect(isTechDeniedApiPath("/api/customers")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports/production")).toBe(true);
    expect(isTechDeniedApiPath("/api/jobs")).toBe(false);
    expect(isTechDeniedApiPath("/api/jobs/job-1")).toBe(false);
  });
});

describe("Operations (ex-Command Center) access — 2026-11-05", () => {
  const operationsPaths = ["/operations", "/operations/live", "/command-center", "/live-operations"];

  it("blocks techs from Operations, its Live view, and the legacy addresses", () => {
    for (const path of operationsPaths) {
      expect(isRoleDeniedPath("tech", path), path).toBe(true);
    }
  });

  it("blocks portal users from Operations entirely", () => {
    for (const path of operationsPaths) {
      expect(isRoleDeniedPath("portal", path), path).toBe(true);
    }
  });

  it("lets office staff, managers, dispatchers, and owners into Operations", () => {
    for (const role of ["owner", "manager", "dispatch", "office"]) {
      expect(isRoleDeniedPath(role, "/operations"), role).toBe(false);
    }
  });

  it("lets sales open the Operations overview but not the Live tab", () => {
    expect(isRoleDeniedPath("sales", "/operations")).toBe(false);
    expect(isRoleDeniedPath("sales", "/operations/live")).toBe(true);
    expect(isRoleDeniedPath("sales", "/live-operations")).toBe(true);
  });

  it("lets office staff into the Live tab", () => {
    expect(isRoleDeniedPath("office", "/operations/live")).toBe(false);
  });

  it("does not treat /ops/feedback as part of /operations", () => {
    expect(isRoleDeniedPath("portal", "/ops/feedback")).toBe(false);
  });
});
