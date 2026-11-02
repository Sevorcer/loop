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
 */
export function buildCloseoutSteps(
  checklist: JobCompletionChecklistStatus,
): CloseoutStep[] {
  return [
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
}

/**
 * Human label for the closeout mode the sibling closeout-mode work adds to
 * the checklist payload (e.g. "visit"). Tolerates the field being absent —
 * returns null so the panel simply shows no mode badge.
 */
export function closeoutModeLabel(mode: string | null | undefined): string | null {
  const value = (mode ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "visit") return "Visit closeout — note only";
  if (value === "full") return "Full closeout";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} closeout`;
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
