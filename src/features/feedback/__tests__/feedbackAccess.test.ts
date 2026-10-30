import { describe, expect, it } from "vitest";

import {
  canDeleteFeedbackReport,
  showFeedbackTriageActions,
} from "@/features/feedback/utils/feedbackAccess";

describe("feedback triage buttons", () => {
  it("hides triage actions from a technician", () => {
    expect(showFeedbackTriageActions("tech")).toBe(false);
  });

  it("shows triage actions to the owner and manager", () => {
    expect(showFeedbackTriageActions("owner")).toBe(true);
    expect(showFeedbackTriageActions("manager")).toBe(true);
  });
});

describe("feedback delete rule", () => {
  const report = { createdByUserId: "user-tech" };

  it("lets the owner delete any report", () => {
    expect(canDeleteFeedbackReport("owner", "user-owner", report)).toBe(true);
  });

  it("lets the person who wrote the report delete it", () => {
    expect(canDeleteFeedbackReport("tech", "user-tech", report)).toBe(true);
    expect(canDeleteFeedbackReport("manager", "user-tech", report)).toBe(true);
  });

  it("blocks a technician from deleting someone else's report", () => {
    expect(canDeleteFeedbackReport("tech", "user-other", report)).toBe(false);
  });
});
