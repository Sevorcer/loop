/**
 * Feedback Reports lives in INSIGHTS for office staff. It is not duplicated
 * in other groups. The /ops/feedback route stays the direct destination.
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

describe("Feedback Reports in the sidebar", () => {
  it("appears once, as the INSIGHTS Feedback Reports link", () => {
    expect(getFeedbackHrefsInNav()).toEqual([ROUTES.OPS_FEEDBACK]);
  });

  it("is the Feedback item inside INSIGHTS", () => {
    const insightsGroup = SHELL_NAV_GROUPS.find((g) => g.label === "INSIGHTS");
    const feedbackItem = insightsGroup?.items.find((i) => i.href === ROUTES.OPS_FEEDBACK);
    expect(feedbackItem?.name).toBe("Feedback Reports");
  });
});
