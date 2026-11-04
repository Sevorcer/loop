"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { JobCloseoutMode, JobStatus } from "../types/job";
import type { JobCompletionChecklistStatus } from "../utils/jobCompletionChecklist";
import {
  buildCloseoutSteps,
  closeoutModeLabel,
  closeoutSectionKeyForStep,
  scrollToJobSection,
  type CloseoutSectionKey,
  type CloseoutStep,
} from "../utils/jobCloseout";
import { JobStatusFailure } from "./JobStatusActions";

/**
 * The completion-checklist payload, plus the closeout mode the closeout-mode
 * work adds to it. The mode drives the mode badge and the step list (Visit
 * shows the job-note step only); completion itself stays gated by the
 * payload's canComplete, which mirrors the server's gates.
 */
type CloseoutChecklist = JobCompletionChecklistStatus & {
  closeoutMode: JobCloseoutMode;
};

interface JobCloseoutPanelProps {
  jobId: string;
  status: JobStatus;
  onAddNote: (note: string) => Promise<void>;
  onUpdateStatus: (status: JobStatus) => Promise<void>;
  /**
   * Optional tab-aware jump: when the host screen organises the job page
   * into tabs, it passes this so a step's jump button switches to the tab
   * that owns the section (and the host scrolls/highlights it there)
   * instead of the panel scrolling the page itself. When absent, the
   * panel keeps the original scroll-to-section behaviour.
   */
  onShowSection?: (section: CloseoutSectionKey) => void;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function StepRow({
  step,
  children,
}: {
  step: CloseoutStep;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {step.complete ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-200">{step.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{step.hint}</p>
          </div>
        </div>
        {step.complete ? (
          <span className="shrink-0 text-xs font-medium text-emerald-300">Done</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Guided closeout: instead of hunting the job page for where each required
 * item lives, the tech opens this panel and works through the remaining
 * steps. The note is filled in inline; the other steps jump straight to the
 * section that owns the information and flash it so the spot is obvious.
 */
export function JobCloseoutPanel({
  jobId,
  status,
  onAddNote,
  onUpdateStatus,
  onShowSection,
}: JobCloseoutPanelProps) {
  const { role } = useCurrentRole();
  const [open, setOpen] = useState(false);
  const [checklist, setChecklist] = useState<CloseoutChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const loadChecklist = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await requestJson<{ checklist: CloseoutChecklist }>(
        `/api/jobs/${jobId}/completion-checklist`,
        { role, cache: "no-store" },
      );
      setChecklist(response.checklist);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load the closeout checklist.",
      );
    } finally {
      setLoading(false);
    }
  }, [jobId, role]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      void loadChecklist();
    });
  }, [open, loadChecklist]);

  async function saveNote() {
    const value = note.trim();
    if (!value) {
      setNoteError("Write a note before saving.");
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      await onAddNote(value);
      setNote("");
      await loadChecklist();
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to save the note.");
    } finally {
      setNoteSaving(false);
    }
  }

  async function completeJob() {
    setCompleting(true);
    setCompleteError(null);
    try {
      await onUpdateStatus("Completed");
      setCompleted(true);
    } catch (error) {
      setCompleteError(
        error instanceof Error ? error.message : "Failed to mark this job complete.",
      );
      // The server's view of what is missing may have changed — refresh ours.
      await loadChecklist();
    } finally {
      setCompleting(false);
    }
  }

  if (completed) {
    return (
      <SurfaceCard>
        <div className="flex items-center gap-3 p-6">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">Job closed out</h2>
            <p className="mt-1 text-sm text-slate-400">
              This job has been marked complete.
            </p>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  // Completing is only a valid transition from In Progress (same rule the
  // Quick Actions Mark Complete button follows).
  if (status !== "In Progress") {
    return null;
  }

  const steps = checklist ? buildCloseoutSteps(checklist) : [];
  const modeLabel = closeoutModeLabel(checklist?.closeoutMode);
  // The multi-day final-day block (same sentence as the completion refusal).
  // It is a still-needed item in both modes, and the payload's canComplete is
  // already false while it stands — the panel never shows "clear" past it.
  const finalDayBlocker = checklist?.finalDayBlocker ?? null;
  const canComplete = Boolean(checklist?.canComplete) && !finalDayBlocker;

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <ClipboardCheck className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Close out</h2>
              {modeLabel ? (
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                  {modeLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Work through what&apos;s left — each step takes you to the right
              spot, no hunting around the page.
            </p>
          </div>
        </div>

        {!open ? (
          <Button
            className="mt-5 min-h-[48px] w-full gap-2 text-base md:min-h-0 md:text-sm"
            onClick={() => setOpen(true)}
          >
            <ClipboardCheck className="h-4 w-4" />
            Start closeout
          </Button>
        ) : (
          <div className="mt-5">
            {loading && !checklist ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking what&apos;s left…
              </div>
            ) : null}

            {loadError ? (
              <div>
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {loadError}
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void loadChecklist()}
                  disabled={loading}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            {checklist ? (
              <>
                <div className="space-y-2">
                  {finalDayBlocker ? (
                    <div
                      data-closeout-blocker="final-day"
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3"
                    >
                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div>
                          <p className="text-sm font-medium text-amber-100">
                            Final scheduled day
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-amber-200/80">
                            {capitalize(finalDayBlocker)}.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {steps.map((step) => (
                    <StepRow key={step.key} step={step}>
                      {!step.complete && step.key === "note" ? (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            rows={3}
                            placeholder="Add a field update, customer note, or closeout detail..."
                            aria-label="Closeout job note"
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40 md:text-sm"
                          />
                          {noteError ? (
                            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                              {noteError}
                            </p>
                          ) : null}
                          <div className="flex justify-end">
                            <Button
                              onClick={() => void saveNote()}
                              disabled={noteSaving}
                              className="min-h-[48px] gap-2 text-base md:min-h-0 md:text-sm"
                            >
                              <Save className="h-4 w-4" />
                              {noteSaving ? "Saving..." : "Save note"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {!step.complete && step.sectionId ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            className="min-h-[48px] gap-2 text-base md:min-h-0 md:text-sm"
                            onClick={() => {
                              const section = onShowSection
                                ? closeoutSectionKeyForStep(step)
                                : null;
                              if (onShowSection && section) {
                                onShowSection(section);
                                return;
                              }
                              scrollToJobSection(step.sectionId!);
                            }}
                          >
                            {step.actionLabel}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-slate-500">
                            Then come back and recheck.
                          </span>
                        </div>
                      ) : null}
                    </StepRow>
                  ))}
                </div>

                {completeError ? <JobStatusFailure message={completeError} /> : null}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="min-h-[48px] flex-1 gap-2 text-base md:min-h-0 md:text-sm"
                    onClick={() => void completeJob()}
                    disabled={!canComplete || completing}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completing ? "Completing..." : "Complete job"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-[48px] gap-2 text-base md:min-h-0 md:text-sm"
                    onClick={() => void loadChecklist()}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {loading ? "Checking..." : "Recheck"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {canComplete
                    ? "Everything's in place — you're clear to complete this job."
                    : finalDayBlocker
                      ? "Complete unlocks on the job's final scheduled day, once every step above is done."
                      : "Complete unlocks when every step above is done."}
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
