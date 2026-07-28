/**
 * Feedback input validation — Sprint 7 Mini-Epic
 *
 * Pure functions with no side-effects; safe to import anywhere including tests.
 */

import type { CreateFeedbackReportInput, UpdateFeedbackReportInput } from "../types/feedbackReport";
import {
  FEEDBACK_SEVERITY_VALUES,
  FEEDBACK_STATUS_VALUES,
} from "../types/feedbackReport";

// ─── Create validation ────────────────────────────────────────────────────────

export type FeedbackCreateValidationResult =
  | { valid: true }
  | { valid: false; errors: Record<string, string> };

/**
 * Validates a CreateFeedbackReportInput.
 * Returns { valid: true } on success or { valid: false, errors } on failure.
 * All checks are pure — no DB calls, no side-effects.
 */
export function validateFeedbackCreate(
  input: Partial<CreateFeedbackReportInput>,
): FeedbackCreateValidationResult {
  const errors: Record<string, string> = {};

  if (!input.intendedAction?.trim()) {
    errors.intendedAction = "What you were trying to do is required.";
  }

  if (!input.actualResult?.trim()) {
    errors.actualResult = "What happened is required.";
  }

  if (!input.severity) {
    errors.severity = "Severity is required.";
  } else if (!(FEEDBACK_SEVERITY_VALUES as readonly string[]).includes(input.severity)) {
    errors.severity = `Invalid severity "${input.severity}". Must be one of: ${FEEDBACK_SEVERITY_VALUES.join(", ")}.`;
  }

  if (!input.routePath?.trim()) {
    errors.routePath = "Route path is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

// ─── Update (triage) validation ───────────────────────────────────────────────

export type FeedbackUpdateValidationResult =
  | { valid: true }
  | { valid: false; errors: Record<string, string> };

/**
 * Validates an UpdateFeedbackReportInput (triage patch).
 */
export function validateFeedbackUpdate(
  input: Partial<UpdateFeedbackReportInput>,
): FeedbackUpdateValidationResult {
  const errors: Record<string, string> = {};

  if (input.status !== undefined) {
    if (!(FEEDBACK_STATUS_VALUES as readonly string[]).includes(input.status)) {
      errors.status = `Invalid status "${input.status}". Must be one of: ${FEEDBACK_STATUS_VALUES.join(", ")}.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
