"use client";

/**
 * FeedbackModal — Sprint 7 Mini-Epic
 *
 * Compact dialog for submitting feedback. Auto-captures route path.
 * Prevents double-submit. Shows inline success with reference ID.
 */

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FEEDBACK_SEVERITY_VALUES,
  FEEDBACK_SEVERITY_LABELS,
  type FeedbackSeverity,
} from "@/features/feedback/types/feedbackReport";

const MAX_SCREENSHOT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

interface FeedbackModalProps {
  contextJobId?: string;
  contextCustomerId?: string;
  contextPropertyId?: string;
  onClose: () => void;
}

export function FeedbackModal({
  contextJobId,
  contextCustomerId,
  contextPropertyId,
  onClose,
}: FeedbackModalProps) {
  const pathname = usePathname();

  const [intendedAction, setIntendedAction] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [severity, setSeverity] = useState<FeedbackSeverity | "">("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setScreenshotError(null);

    if (!file) {
      setScreenshot(null);
      return;
    }

    const allowed = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    const normalizedType = file.type.toLowerCase() === "image/jpg" ? "image/jpeg" : file.type.toLowerCase();

    if (!allowed.has(normalizedType)) {
      setScreenshotError("Screenshot must be a JPEG, PNG, or WebP image.");
      setScreenshot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
      setScreenshotError("Screenshot must be smaller than 10 MB.");
      setScreenshot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setScreenshot(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: Record<string, string> = {};
    if (!intendedAction.trim()) {
      errors.intendedAction = "This field is required.";
    }
    if (!actualResult.trim()) {
      errors.actualResult = "This field is required.";
    }
    if (!severity) {
      errors.severity = "Please select a severity.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;

      if (screenshot) {
        const fd = new FormData();
        fd.append("severity", severity);
        fd.append("intendedAction", intendedAction.trim());
        fd.append("actualResult", actualResult.trim());
        fd.append("routePath", pathname);
        if (contextJobId) fd.append("contextJobId", contextJobId);
        if (contextCustomerId) fd.append("contextCustomerId", contextCustomerId);
        if (contextPropertyId) fd.append("contextPropertyId", contextPropertyId);
        fd.append("screenshot", screenshot);
        body = fd;
        // let browser set content-type with boundary
      } else {
        body = JSON.stringify({
          severity,
          intendedAction: intendedAction.trim(),
          actualResult: actualResult.trim(),
          routePath: pathname,
          contextJobId: contextJobId ?? null,
          contextCustomerId: contextCustomerId ?? null,
          contextPropertyId: contextPropertyId ?? null,
        });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body,
      });

      const data = await res.json().catch(() => ({})) as { report?: { id: string } };

      if (res.ok && data.report?.id) {
        setSubmittedId(data.report.id);
        return;
      }

      setFormError(
        (data as { message?: string }).message ??
        "Failed to submit feedback. Please try again.",
      );
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Overlay close on background click ──────────────────────────────────────

  function handleBackdropClick() {
    if (!isSubmitting) {
      onClose();
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (submittedId) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-success-title"
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-xl text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 id="feedback-success-title" className="mb-1 text-base font-semibold text-primary">
            Feedback submitted
          </h2>
          <p className="mb-1 text-sm text-muted">Thank you — we&apos;ll triage this shortly.</p>
          <p className="mb-5 font-mono text-xs text-muted">
            Ref: <span className="text-slate-300">{submittedId.slice(0, 8).toUpperCase()}</span>
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 sm:items-center sm:py-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-default bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <h2 id="feedback-dialog-title" className="text-sm font-semibold text-primary">
            Report Feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
          {formError ? (
            <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {formError}
            </p>
          ) : null}

          {/* What were you trying to do? */}
          <div className="space-y-1.5">
            <label htmlFor="fb-intended-action" className="block text-xs font-medium text-primary">
              What were you trying to do? <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <textarea
              id="fb-intended-action"
              value={intendedAction}
              onChange={(e) => setIntendedAction(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              aria-required="true"
              aria-describedby={fieldErrors.intendedAction ? "fb-intended-error" : undefined}
              aria-invalid={Boolean(fieldErrors.intendedAction)}
              placeholder="e.g. I was trying to dispatch a crew to the job…"
              className="w-full resize-none rounded-xl border border-default bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {fieldErrors.intendedAction ? (
              <p id="fb-intended-error" role="alert" className="text-xs text-red-400">
                {fieldErrors.intendedAction}
              </p>
            ) : null}
          </div>

          {/* What happened? */}
          <div className="space-y-1.5">
            <label htmlFor="fb-actual-result" className="block text-xs font-medium text-primary">
              What happened? <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <textarea
              id="fb-actual-result"
              value={actualResult}
              onChange={(e) => setActualResult(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              aria-required="true"
              aria-describedby={fieldErrors.actualResult ? "fb-actual-error" : undefined}
              aria-invalid={Boolean(fieldErrors.actualResult)}
              placeholder="e.g. The page showed an error and the crew wasn't assigned…"
              className="w-full resize-none rounded-xl border border-default bg-surface-elevated px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {fieldErrors.actualResult ? (
              <p id="fb-actual-error" role="alert" className="text-xs text-red-400">
                {fieldErrors.actualResult}
              </p>
            ) : null}
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <label htmlFor="fb-severity" className="block text-xs font-medium text-primary">
              Severity <span className="text-red-400" aria-hidden="true">*</span>
            </label>
            <select
              id="fb-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as FeedbackSeverity | "")}
              required
              aria-required="true"
              aria-describedby={fieldErrors.severity ? "fb-severity-error" : undefined}
              aria-invalid={Boolean(fieldErrors.severity)}
              className="w-full rounded-xl border border-default bg-surface-elevated px-3 py-2 text-sm text-primary focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="" disabled>
                Select severity…
              </option>
              {FEEDBACK_SEVERITY_VALUES.map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">
              P0 = system down / blocking · P1 = major issue · P2 = degraded · P3 = minor
            </p>
            {fieldErrors.severity ? (
              <p id="fb-severity-error" role="alert" className="text-xs text-red-400">
                {fieldErrors.severity}
              </p>
            ) : null}
          </div>

          {/* Screenshot (optional) */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-primary">
              Screenshot <span className="text-muted font-normal">(optional · JPEG, PNG, WebP · max 10 MB)</span>
            </p>
            <div className="flex items-center gap-3">
              <label
                htmlFor="fb-screenshot"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-default px-3 py-1.5 text-xs text-muted transition-colors hover:border-white/20 hover:text-primary"
              >
                <Paperclip size={12} />
                {screenshot ? screenshot.name : "Attach screenshot"}
              </label>
              <input
                ref={fileInputRef}
                id="fb-screenshot"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleScreenshotChange}
                className="sr-only"
                aria-label="Upload screenshot"
              />
              {screenshot ? (
                <button
                  type="button"
                  onClick={() => {
                    setScreenshot(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-muted hover:text-primary"
                  aria-label="Remove screenshot"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {screenshotError ? (
              <p role="alert" className="text-xs text-red-400">{screenshotError}</p>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
