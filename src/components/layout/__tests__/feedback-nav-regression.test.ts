/**
 * Regression tests: Feedback nav item removal from primary sidebar (PR1).
 *
 * Guards that Feedback does NOT appear as a primary nav item (moved to Settings/
 * admin area and accessible via the floating FAB). The /ops/feedback route and
 * page remain intact for direct access.
 */
import { describe, it, expect } from "vitest";

import { ROUTES } from "@/lib/routes";
import { SHELL_NAV_GROUPS } from "../sidebarNav";

function getFeedbackHrefsInNav() {
  return SHELL_NAV_GROUPS
    .flatMap((g) => g.items)
    .filter((item) => item.href === ROUTES.OPS_FEEDBACK)
    .map((item) => item.href);
}

// ─── Feedback is NOT present in the primary sidebar (PR1 IA hardening) ────────

describe("Feedback nav item — PR1 removal from primary nav", () => {
  it("Feedback is not present in any SHELL_NAV_GROUPS item (floating FAB is the entry point)", () => {
    expect(getFeedbackHrefsInNav()).toHaveLength(0);
  });

  it("no group is labelled INSIGHTS with a Feedback item", () => {
    const insightsGroup = SHELL_NAV_GROUPS.find((g) => g.label === "INSIGHTS");
    const feedbackItem = insightsGroup?.items.find((i) => i.href === ROUTES.OPS_FEEDBACK);
    expect(feedbackItem).toBeUndefined();
  });
});
