/**
 * Feedback validation unit tests — Sprint 7 Mini-Epic
 *
 * Tests pure validation logic. No React, no DB.
 */

import { describe, it, expect } from "vitest";

import {
  validateFeedbackCreate,
  validateFeedbackUpdate,
} from "../utils/feedbackValidation";
import type { CreateFeedbackReportInput, UpdateFeedbackReportInput } from "../types/feedbackReport";

// ─── validateFeedbackCreate ───────────────────────────────────────────────────

const validCreate: CreateFeedbackReportInput = {
  severity: "P1",
  intendedAction: "I was trying to assign a crew.",
  actualResult: "The page returned an error.",
  routePath: "/dispatch",
};

describe("validateFeedbackCreate", () => {
  it("returns valid for complete, correct input", () => {
    expect(validateFeedbackCreate(validCreate)).toEqual({ valid: true });
  });

  it("requires intendedAction", () => {
    const result = validateFeedbackCreate({ ...validCreate, intendedAction: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.intendedAction).toMatch(/required/i);
    }
  });

  it("requires intendedAction (whitespace only)", () => {
    const result = validateFeedbackCreate({ ...validCreate, intendedAction: "   " });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.intendedAction).toBeDefined();
    }
  });

  it("requires actualResult", () => {
    const result = validateFeedbackCreate({ ...validCreate, actualResult: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.actualResult).toMatch(/required/i);
    }
  });

  it("requires severity", () => {
    const result = validateFeedbackCreate({ ...validCreate, severity: "" as never });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.severity).toMatch(/required/i);
    }
  });

  it("rejects unknown severity values", () => {
    const result = validateFeedbackCreate({ ...validCreate, severity: "P9" as never });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.severity).toMatch(/invalid/i);
    }
  });

  it("accepts all valid severity values: P0, P1, P2, P3", () => {
    const severities = ["P0", "P1", "P2", "P3"] as const;
    for (const s of severities) {
      expect(validateFeedbackCreate({ ...validCreate, severity: s })).toEqual({ valid: true });
    }
  });

  it("requires routePath", () => {
    const result = validateFeedbackCreate({ ...validCreate, routePath: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.routePath).toMatch(/required/i);
    }
  });

  it("collects multiple errors", () => {
    const result = validateFeedbackCreate({
      severity: "" as never,
      intendedAction: "",
      actualResult: "",
      routePath: "",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("allows optional context IDs to be omitted", () => {
    expect(
      validateFeedbackCreate({
        ...validCreate,
        contextJobId: null,
        contextCustomerId: undefined,
        contextPropertyId: null,
      }),
    ).toEqual({ valid: true });
  });
});

// ─── validateFeedbackUpdate ───────────────────────────────────────────────────

describe("validateFeedbackUpdate", () => {
  it("returns valid for an empty patch (no fields being changed)", () => {
    expect(validateFeedbackUpdate({})).toEqual({ valid: true });
  });

  it("accepts all valid status values", () => {
    const statuses: UpdateFeedbackReportInput["status"][] = [
      "new",
      "triaged",
      "in_progress",
      "resolved",
      "wontfix",
    ];
    for (const status of statuses) {
      expect(validateFeedbackUpdate({ status })).toEqual({ valid: true });
    }
  });

  it("rejects unknown status values", () => {
    const result = validateFeedbackUpdate({ status: "unknown" as never });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.status).toMatch(/invalid/i);
    }
  });

  it("accepts triageNotes as null", () => {
    expect(validateFeedbackUpdate({ triageNotes: null })).toEqual({ valid: true });
  });

  it("accepts triageNotes as a non-empty string", () => {
    expect(
      validateFeedbackUpdate({ status: "triaged", triageNotes: "Reproduced, root cause identified." }),
    ).toEqual({ valid: true });
  });
});
