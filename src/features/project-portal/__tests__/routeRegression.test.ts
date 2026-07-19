import { describe, it, expect } from "vitest";

import { ROUTES, PORTAL_ROUTES } from "@/lib/routes";

/**
 * Regression tests to ensure the portal routes addition did not
 * break any existing ROUTES constants or their values.
 *
 * These tests are deliberately simple — they verify the route constants
 * are correctly defined and have not been accidentally overwritten.
 */
describe("existing routes — no regression from portal addition", () => {
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

  it("ROUTES.REPORTING is /reporting", () => {
    expect(ROUTES.REPORTING).toBe("/reporting");
  });

  it("ROUTES.DISPATCH is /dispatch", () => {
    expect(ROUTES.DISPATCH).toBe("/dispatch");
  });

  it("ROUTES.DAILY_PLANS is /daily-plans", () => {
    expect(ROUTES.DAILY_PLANS).toBe("/daily-plans");
  });

  it("ROUTES.INVENTORY is /inventory", () => {
    expect(ROUTES.INVENTORY).toBe("/inventory");
  });

  it("ROUTES.COMPANY_BRAIN is /company-brain", () => {
    expect(ROUTES.COMPANY_BRAIN).toBe("/company-brain");
  });

  it("ROUTES.SETTINGS is /settings", () => {
    expect(ROUTES.SETTINGS).toBe("/settings");
  });

  it("ROUTES.INSTALLED_SYSTEMS is /installed-systems", () => {
    expect(ROUTES.INSTALLED_SYSTEMS).toBe("/installed-systems");
  });
});

describe("PORTAL_ROUTES — correct path generation", () => {
  it("ROOT is /portal", () => {
    expect(PORTAL_ROUTES.ROOT).toBe("/portal");
  });

  it("OVERVIEW generates /portal/{id}/overview", () => {
    expect(PORTAL_ROUTES.OVERVIEW("proj-001")).toBe("/portal/proj-001/overview");
  });

  it("TIMELINE generates /portal/{id}/timeline", () => {
    expect(PORTAL_ROUTES.TIMELINE("proj-001")).toBe("/portal/proj-001/timeline");
  });

  it("DOCUMENTS generates /portal/{id}/documents", () => {
    expect(PORTAL_ROUTES.DOCUMENTS("proj-001")).toBe("/portal/proj-001/documents");
  });

  it("CONTACT generates /portal/{id}/contact", () => {
    expect(PORTAL_ROUTES.CONTACT("proj-001")).toBe("/portal/proj-001/contact");
  });

  it("ERROR_UNAUTHORIZED is /portal/error/unauthorized", () => {
    expect(PORTAL_ROUTES.ERROR_UNAUTHORIZED).toBe("/portal/error/unauthorized");
  });

  it("ERROR_EXPIRED_INVITE is /portal/error/expired-invite", () => {
    expect(PORTAL_ROUTES.ERROR_EXPIRED_INVITE).toBe("/portal/error/expired-invite");
  });

  it("ERROR_REVOKED is /portal/error/revoked", () => {
    expect(PORTAL_ROUTES.ERROR_REVOKED).toBe("/portal/error/revoked");
  });

  it("ERROR_NOT_FOUND is /portal/error/not-found", () => {
    expect(PORTAL_ROUTES.ERROR_NOT_FOUND).toBe("/portal/error/not-found");
  });
});
