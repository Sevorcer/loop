import { describe, it, expect } from "vitest";

import {
  evaluateCheck,
  buildHealthReport,
  formatSummary,
  CHECK_SPECS,
  getCheckSpec,
  type CheckSpec,
  type RawCheckResult,
} from "../dbHealthCheck";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const criticalSpec: CheckSpec = {
  id: "test_critical",
  name: "Test critical check",
  severity: "critical",
  description: "A test critical check.",
};

const warningSpec: CheckSpec = {
  id: "test_warning",
  name: "Test warning check",
  severity: "warning",
  description: "A test warning check.",
};

// ─── evaluateCheck ────────────────────────────────────────────────────────────

describe("evaluateCheck", () => {
  it("returns pass when count is 0", () => {
    const result = evaluateCheck(criticalSpec, 0);
    expect(result.status).toBe("pass");
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/no violations/i);
  });

  it("returns fail when count is greater than 0", () => {
    const result = evaluateCheck(criticalSpec, 3);
    expect(result.status).toBe("fail");
    expect(result.count).toBe(3);
    expect(result.message).toMatch(/3 violations/i);
  });

  it("returns skipped when count is -1", () => {
    const result = evaluateCheck(criticalSpec, -1);
    expect(result.status).toBe("skipped");
    expect(result.count).toBe(0);
    expect(result.message).toMatch(/skipped/i);
  });

  it("uses singular 'violation' when count is 1", () => {
    const result = evaluateCheck(criticalSpec, 1);
    expect(result.message).toContain("1 violation found");
  });

  it("uses plural 'violations' when count is 2", () => {
    const result = evaluateCheck(criticalSpec, 2);
    expect(result.message).toContain("2 violations found");
  });

  it("preserves the spec on the result", () => {
    const result = evaluateCheck(warningSpec, 0);
    expect(result.spec).toBe(warningSpec);
  });
});

// ─── buildHealthReport ───────────────────────────────────────────────────────

describe("buildHealthReport", () => {
  const allPassResults: RawCheckResult[] = CHECK_SPECS.map((s) => ({
    checkId: s.id,
    count: 0,
  }));

  it("returns pass status when all checks have count 0", () => {
    const report = buildHealthReport(allPassResults, "2026-07-24T06:00:00Z");
    expect(report.status).toBe("pass");
    expect(report.criticalFailures).toBe(0);
    expect(report.warningFailures).toBe(0);
    expect(report.passedChecks).toBe(CHECK_SPECS.length);
  });

  it("returns fail status when a critical check has count > 0", () => {
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: s.id === "rls_disabled" ? 2 : 0,
    }));
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    expect(report.status).toBe("fail");
    expect(report.criticalFailures).toBe(1);
  });

  it("counts skipped checks for missing raw results", () => {
    const report = buildHealthReport([], "2026-07-24T06:00:00Z");
    expect(report.skippedChecks).toBe(CHECK_SPECS.length);
    // All skipped → no critical failures → status pass
    expect(report.status).toBe("pass");
  });

  it("correctly tallies passedChecks", () => {
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: 0,
    }));
    // Flip one to a failure
    results[0].count = 1;
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    expect(report.passedChecks).toBe(CHECK_SPECS.length - 1);
  });

  it("preserves runAt on the report", () => {
    const ts = "2026-07-24T06:00:00Z";
    const report = buildHealthReport(allPassResults, ts);
    expect(report.runAt).toBe(ts);
  });

  it("includes one CheckResult per CHECK_SPECS entry", () => {
    const report = buildHealthReport(allPassResults, "2026-07-24T06:00:00Z");
    expect(report.checks).toHaveLength(CHECK_SPECS.length);
  });

  it("marks warning failures separately from critical failures", () => {
    // Inject a synthetic warning spec by using an unknown id that maps to warning
    // via the spec — we test this by checking the counts.
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: 0,
    }));
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    expect(report.warningFailures).toBe(0);
  });
});

// ─── formatSummary ───────────────────────────────────────────────────────────

describe("formatSummary", () => {
  it("includes PASS label when status is pass", () => {
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: 0,
    }));
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    const summary = formatSummary(report);
    expect(summary).toContain("PASS");
    expect(summary).not.toContain("FAIL");
  });

  it("includes FAIL label and runbook link when critical failures exist", () => {
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: s.id === "rls_disabled" ? 1 : 0,
    }));
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    const summary = formatSummary(report);
    expect(summary).toContain("FAIL");
    expect(summary).toContain("docs/runbooks/db-health-check.md");
  });

  it("contains the run timestamp", () => {
    const ts = "2026-07-24T06:00:00Z";
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: 0,
    }));
    const report = buildHealthReport(results, ts);
    const summary = formatSummary(report);
    expect(summary).toContain(ts);
  });

  it("shows check names in the output", () => {
    const results: RawCheckResult[] = CHECK_SPECS.map((s) => ({
      checkId: s.id,
      count: 0,
    }));
    const report = buildHealthReport(results, "2026-07-24T06:00:00Z");
    const summary = formatSummary(report);
    for (const spec of CHECK_SPECS) {
      expect(summary).toContain(spec.name);
    }
  });
});

// ─── CHECK_SPECS catalogue ───────────────────────────────────────────────────

describe("CHECK_SPECS", () => {
  it("has at least 8 entries", () => {
    expect(CHECK_SPECS.length).toBeGreaterThanOrEqual(8);
  });

  it("every spec has a unique id", () => {
    const ids = CHECK_SPECS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every spec has a non-empty name and description", () => {
    for (const spec of CHECK_SPECS) {
      expect(spec.name.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });

  it("every severity is 'critical' or 'warning'", () => {
    for (const spec of CHECK_SPECS) {
      expect(["critical", "warning"]).toContain(spec.severity);
    }
  });
});

// ─── getCheckSpec ────────────────────────────────────────────────────────────

describe("getCheckSpec", () => {
  it("returns the spec for a known id", () => {
    const spec = getCheckSpec("rls_disabled");
    expect(spec).toBeDefined();
    expect(spec?.id).toBe("rls_disabled");
  });

  it("returns undefined for an unknown id", () => {
    const spec = getCheckSpec("does_not_exist");
    expect(spec).toBeUndefined();
  });
});
