import { describe, expect, it } from "vitest";

import {
  isPrepOrRoughInVisit,
  requiresStartupAndInstalledSystemGates,
} from "../jobInstallStage";

describe("isPrepOrRoughInVisit", () => {
  it("flags JOB-1019 style prep titles", () => {
    expect(isPrepOrRoughInVisit("Lineset/ODU Prep", "Place ODU/Connect lineset")).toBe(true);
    expect(isPrepOrRoughInVisit("Lineset routing/insulating")).toBe(true);
    expect(isPrepOrRoughInVisit("Horton Rough-in")).toBe(true);
    expect(isPrepOrRoughInVisit("Install: Pressurize linesets")).toBe(true);
  });

  it("does not flag real install/startup visits", () => {
    expect(
      isPrepOrRoughInVisit(
        "Hang wall cassette unit + route lineset to exterior. Install drain.",
      ),
    ).toBe(false);
    expect(
      isPrepOrRoughInVisit("heat pump installed and the systems commissioned"),
    ).toBe(false);
    expect(isPrepOrRoughInVisit("Startup and fire-off")).toBe(false);
  });
});

describe("requiresStartupAndInstalledSystemGates", () => {
  it("is false for visit mode and prep visits", () => {
    expect(
      requiresStartupAndInstalledSystemGates({
        closeoutMode: "visit",
        title: "Anything",
      }),
    ).toBe(false);
    expect(
      requiresStartupAndInstalledSystemGates({
        closeoutMode: "full",
        title: "Lineset/ODU Prep",
      }),
    ).toBe(false);
  });

  it("is true for ordinary full install jobs", () => {
    expect(
      requiresStartupAndInstalledSystemGates({
        closeoutMode: "full",
        title: "Install heat pump",
      }),
    ).toBe(true);
  });
});
