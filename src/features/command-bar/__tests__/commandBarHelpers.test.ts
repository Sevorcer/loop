import { describe, expect, it } from "vitest";

import { isCloseShortcut, isOpenShortcut } from "../utils/shortcut";
import { getTriggerLayout } from "../utils/trigger";

describe("command bar shortcuts", () => {
  it("opens on Ctrl+K", () => {
    expect(isOpenShortcut({ key: "k", ctrlKey: true, metaKey: false })).toBe(true);
  });

  it("opens on Cmd+K", () => {
    expect(isOpenShortcut({ key: "k", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("does not open on unrelated keys", () => {
    expect(isOpenShortcut({ key: "x", ctrlKey: true, metaKey: false })).toBe(false);
  });

  it("closes on Escape", () => {
    expect(isCloseShortcut({ key: "Escape" })).toBe(true);
  });
});

describe("command bar trigger layout", () => {
  it("returns desktop layout at >=640px", () => {
    expect(getTriggerLayout(1024)).toBe("desktop");
    expect(getTriggerLayout(640)).toBe("desktop");
  });

  it("returns mobile layout below 640px", () => {
    expect(getTriggerLayout(639)).toBe("mobile");
  });
});
