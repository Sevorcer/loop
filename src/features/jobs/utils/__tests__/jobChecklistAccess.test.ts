import { describe, expect, it } from "vitest";

import {
  canAddJobChecklistItem,
  canEditJobChecklistItem,
  canRemoveJobChecklistItem,
} from "../jobChecklistAccess";

describe("canAddJobChecklistItem", () => {
  it("allows every internal role", () => {
    for (const role of ["owner", "manager", "dispatch", "tech", "office", "sales"] as const) {
      expect(canAddJobChecklistItem(role)).toBe(true);
    }
  });

  it("denies portal and missing roles", () => {
    expect(canAddJobChecklistItem("portal")).toBe(false);
    expect(canAddJobChecklistItem(null)).toBe(false);
    expect(canAddJobChecklistItem(undefined)).toBe(false);
  });
});

describe("canRemoveJobChecklistItem (R1)", () => {
  it("allows office and above plus techs", () => {
    for (const role of ["owner", "manager", "office", "tech"] as const) {
      expect(canRemoveJobChecklistItem(role)).toBe(true);
    }
  });

  it("denies dispatch, sales, and portal", () => {
    expect(canRemoveJobChecklistItem("dispatch")).toBe(false);
    expect(canRemoveJobChecklistItem("sales")).toBe(false);
    expect(canRemoveJobChecklistItem("portal")).toBe(false);
    expect(canRemoveJobChecklistItem(null)).toBe(false);
  });
});

describe("canEditJobChecklistItem", () => {
  it("allows office roles and techs to rename", () => {
    for (const role of ["owner", "manager", "office", "dispatch", "tech"] as const) {
      expect(canEditJobChecklistItem(role)).toBe(true);
    }
    expect(canEditJobChecklistItem("sales")).toBe(false);
  });
});
