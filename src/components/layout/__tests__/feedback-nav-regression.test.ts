/**
 * Regression tests: Feedback nav item visibility.
 *
 * Guards against accidental removal of the Feedback nav item from the sidebar
 * and ensures it appears for the correct roles (owner, manager) and is hidden
 * for roles that should not see the ops triage screen.
 */
import { describe, it, expect } from "vitest";

import { ROUTES } from "@/lib/routes";
import { getNavItemsForRole } from "@/features/auth";
import { SHELL_NAV_GROUPS } from "../sidebarNav";

function getFeedbackHrefsForRole(role: string) {
  return getNavItemsForRole(role, SHELL_NAV_GROUPS)
    .flatMap((g) => g.items)
    .filter((item) => item.href === ROUTES.OPS_FEEDBACK)
    .map((item) => item.href);
}

// ─── Feedback is present in the INSIGHTS group ───────────────────────────────

describe("Feedback nav item — INSIGHTS group structure", () => {
  const insightsGroup = SHELL_NAV_GROUPS.find((g) => g.label === "INSIGHTS");

  it("INSIGHTS group exists", () => {
    expect(insightsGroup).toBeDefined();
  });

  it("Feedback item is in the INSIGHTS group", () => {
    const hrefs = insightsGroup!.items.map((i) => i.href);
    expect(hrefs).toContain(ROUTES.OPS_FEEDBACK);
  });

  it("Feedback is named 'Feedback'", () => {
    const item = insightsGroup!.items.find((i) => i.href === ROUTES.OPS_FEEDBACK);
    expect(item?.name).toBe("Feedback");
  });
});

// ─── Feedback is visible for roles with triage access ────────────────────────

describe("Feedback nav item — role visibility (regression)", () => {
  it("is visible to owner", () => {
    expect(getFeedbackHrefsForRole("owner")).toContain(ROUTES.OPS_FEEDBACK);
  });

  it("is visible to manager", () => {
    expect(getFeedbackHrefsForRole("manager")).toContain(ROUTES.OPS_FEEDBACK);
  });

  it("is NOT visible to tech (field-only access)", () => {
    expect(getFeedbackHrefsForRole("tech")).not.toContain(ROUTES.OPS_FEEDBACK);
  });

  it("is NOT visible to dispatch", () => {
    expect(getFeedbackHrefsForRole("dispatch")).not.toContain(ROUTES.OPS_FEEDBACK);
  });

  it("is NOT visible to portal users", () => {
    expect(getFeedbackHrefsForRole("portal")).not.toContain(ROUTES.OPS_FEEDBACK);
  });
});
