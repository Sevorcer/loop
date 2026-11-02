import type { JobCloseoutMode } from "../types/job";
import type { JobCompletionChecklistStatus } from "./jobCompletionChecklist";

/**
 * Anchor ids for the job-detail sections the guided closeout flow jumps to.
 * JobDetailScreen renders wrapper elements with these ids around the
 * Photos & Files panel, the completion/QA checklist card, and the installed
 * systems panel so a closeout step can take the user straight to the spot
 * where that piece of information lives.
 */
export const JOB_CLOSEOUT_SECTION_IDS = {
  photos: "job-closeout-photos",
  qa: "job-closeout-qa",
  systems: "job-closeout-systems",
} as const;

export type CloseoutStepKey = "note" | "photo" | "qa" | "systems";

/**
 * Tab sections of the job detail page that own a closeout step's
 * information. Screens that organise the job page into tabs use this to
 * route a step's jump button to the tab that owns the section instead of
 * scrolling the single long page.
 */
export type CloseoutSectionKey = "files" | "tasks" | "systems";

const SECTION_KEY_BY_STEP_KEY: Record<
  Exclude<CloseoutStepKey, "note">,
  CloseoutSectionKey
> = {
  photo: "files",
  qa: "tasks",
  systems: "systems",
};

/**
 * Maps a closeout step to the tab section that owns it. The note step is
 * handled inline in the closeout panel, so it maps to null.
 */
export function closeoutSectionKeyForStep(
  step: CloseoutStep,
): CloseoutSectionKey | null {
  if (step.key === "note") return null;
  return SECTION_KEY_BY_STEP_KEY[step.key];
}

export interface CloseoutStep {
  key: CloseoutStepKey;
  label: string;
  hint: string;
  complete: boolean;
  /** Section the step jumps to, or null when the step is handled inline. */
  sectionId: string | null;
  /** Label for the jump button on steps that are handled in a page section. */
  actionLabel: string | null;
}

/**
 * The guided closeout steps, in the order a tech should work through them.
 * Driven entirely by the completion-checklist payload so the panel always
 * agrees with what the server will require before completing the job.
 * Visit closeout is gated on the job note alone, so its step list is the
 * note step only — the photo, QA, and installed-systems gates do not apply.
 */
export function buildCloseoutSteps(
  checklist: JobCompletionChecklistStatus & {
    closeoutMode?: JobCloseoutMode | null;
  },
): CloseoutStep[] {
  const steps: CloseoutStep[] = [
    {
      key: "note",
      label: "Job note",
      hint: "Add a note about the work — what was done and anything the office should know.",
      complete: checklist.jobNotesCompleted,
      sectionId: null,
      actionLabel: null,
    },
    {
      key: "photo",
      label: "Photo",
      hint: "At least one photo from the job site, uploaded by the field team.",
      complete: checklist.photosUploaded,
      sectionId: JOB_CLOSEOUT_SECTION_IDS.photos,
      actionLabel: "Go to Photos & Files",
    },
    {
      key: "qa",
      label: "QA checklist",
      hint: "Finish the required QA items on the completion checklist.",
      complete: checklist.requiredQaItemsComplete,
      sectionId: JOB_CLOSEOUT_SECTION_IDS.qa,
      actionLabel: "Go to QA checklist",
    },
    {
      key: "systems",
      label: "Installed systems",
      hint: "Record the equipment installed on this job.",
      complete: checklist.installedSystemsEntered,
      sectionId: JOB_CLOSEOUT_SECTION_IDS.systems,
      actionLabel: "Go to Installed systems",
    },
  ];

  if (checklist.closeoutMode === "visit") {
    return steps.filter((step) => step.key === "note");
  }
  return steps;
}

/**
 * Human label for the closeout mode carried on the checklist payload.
 * The mode is a closed type ("full" | "visit"); an absent mode returns
 * null so the panel simply shows no mode badge.
 */
export function closeoutModeLabel(
  mode: JobCloseoutMode | null | undefined,
): string | null {
  if (mode === "visit") return "Visit closeout — note only";
  if (mode === "full") return "Full closeout";
  return null;
}

const HIGHLIGHT_CLASSES = ["ring-2", "ring-amber-300/80"];

/**
 * Scrolls to a job-detail section and flashes a ring around it so the user
 * can see exactly where the information goes. Safe to call when the section
 * is missing (no-op).
 */
export function scrollToJobSection(sectionId: string): void {
  if (typeof document === "undefined") return;
  const element = document.getElementById(sectionId);
  if (!element) return;
  element.scrollIntoView?.({ behavior: "smooth", block: "start" });
  element.classList.add(...HIGHLIGHT_CLASSES);
  window.setTimeout(() => {
    element.classList.remove(...HIGHLIGHT_CLASSES);
  }, 2000);
}
