import { describe, expect, it } from "vitest";

import {
  canAddJobChecklistItem,
  canCheckJobTask,
  canRemoveJobChecklistItem,
} from "@/features/jobs/utils/jobChecklistAccess";

describe("job checklist access", () => {
  it("lets anyone on the team add an item, including a technician", () => {
    for (const role of ["owner", "manager", "dispatch", "tech", "office", "sales"]) {
      expect(canAddJobChecklistItem(role)).toBe(true);
    }
  });

  it("keeps the customer portal and signed-out callers off the add path", () => {
    expect(canAddJobChecklistItem("portal")).toBe(false);
    expect(canAddJobChecklistItem(null)).toBe(false);
    expect(canAddJobChecklistItem(undefined)).toBe(false);
  });

  it("lets only office and above remove an item", () => {
    for (const role of ["owner", "manager", "office"]) {
      expect(canRemoveJobChecklistItem(role)).toBe(true);
    }
  });

  it("does not let a technician or dispatch remove an item", () => {
    expect(canRemoveJobChecklistItem("tech")).toBe(false);
    expect(canRemoveJobChecklistItem("dispatch")).toBe(false);
    expect(canRemoveJobChecklistItem("sales")).toBe(false);
    expect(canRemoveJobChecklistItem("portal")).toBe(false);
    expect(canRemoveJobChecklistItem(null)).toBe(false);
  });

  it("lets a technician and office roles check an item off", () => {
    for (const role of ["owner", "manager", "office", "dispatch", "tech"]) {
      expect(canCheckJobTask(role)).toBe(true);
    }
  });

  it("keeps sales and portal off the check path", () => {
    expect(canCheckJobTask("sales")).toBe(false);
    expect(canCheckJobTask("portal")).toBe(false);
    expect(canCheckJobTask(null)).toBe(false);
  });
});
