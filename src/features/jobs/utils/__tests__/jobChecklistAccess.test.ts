import { describe, expect, it } from "vitest";

import { canCheckJobTask, canManageJobChecklist } from "@/features/jobs/utils/jobChecklistAccess";

describe("job checklist access", () => {
  it("lets office roles add and remove items, including dispatch", () => {
    for (const role of ["owner", "manager", "office", "dispatch"]) {
      expect(canManageJobChecklist(role)).toBe(true);
      expect(canCheckJobTask(role)).toBe(true);
    }
  });

  it("lets a technician check an item off and not manage the list", () => {
    expect(canCheckJobTask("tech")).toBe(true);
    expect(canManageJobChecklist("tech")).toBe(false);
  });

  it("keeps sales and portal off the checklist writes", () => {
    expect(canManageJobChecklist("sales")).toBe(false);
    expect(canCheckJobTask("sales")).toBe(false);
    expect(canManageJobChecklist("portal")).toBe(false);
    expect(canCheckJobTask("portal")).toBe(false);
    expect(canManageJobChecklist(null)).toBe(false);
  });
});
