import { describe, expect, it } from "vitest";

import { countInstallsAtRisk } from "../utils/materialRisk";

const risky = { state: "at_risk" as const, reason: null, needsSku: 0 };
const fine = { state: "ok" as const, reason: null, needsSku: 0 };

describe("countInstallsAtRisk", () => {
  const today = "2026-11-05";

  it("counts at-risk installs starting today through three days out", () => {
    const jobs = [
      { id: "a", type: "Install", scheduledFor: "2026-11-05" },
      { id: "b", type: "Install", scheduledFor: "2026-11-08" },
      { id: "c", type: "Install", scheduledFor: "2026-11-09" },
      { id: "d", type: "Install", scheduledFor: "2026-11-04" },
    ];
    const readiness = { a: risky, b: risky, c: risky, d: risky };
    expect(countInstallsAtRisk(jobs, readiness, today)).toBe(2);
  });

  it("ignores covered jobs, non-installs, unscheduled jobs and jobs without a plan", () => {
    const jobs = [
      { id: "a", type: "Install", scheduledFor: "2026-11-06" },
      { id: "b", type: "Service", scheduledFor: "2026-11-06" },
      { id: "c", type: "Install", scheduledFor: null },
      { id: "d", type: "Install", scheduledFor: "2026-11-06" },
    ];
    expect(countInstallsAtRisk(jobs, { a: fine, b: risky, c: risky }, today)).toBe(0);
  });
});
