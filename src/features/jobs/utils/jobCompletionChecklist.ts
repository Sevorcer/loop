import type { JobCloseoutMode } from "../types/job";
import type { JobActivity } from "../types/jobActivity";

export interface RequiredQaChecklist {
  startupVerificationComplete: boolean;
  safetyReviewComplete: boolean;
  workAreaCleaned: boolean;
}

export const REQUIRED_QA_CHECKLIST_ITEMS = [
  {
    key: "startupVerificationComplete",
    label: "Startup verification complete",
  },
  {
    key: "safetyReviewComplete",
    label: "Safety review complete",
  },
  {
    key: "workAreaCleaned",
    label: "Work area cleaned",
  },
] as const satisfies ReadonlyArray<{ key: keyof RequiredQaChecklist; label: string }>;

export interface JobCompletionChecklistStatus {
  closeoutMode: JobCloseoutMode;
  photosUploaded: boolean;
  installedSystemsEntered: boolean;
  /**
   * Crew attested that no system was installed — satisfies the systems gate.
   * Optional like the materials fields so older fixtures keep compiling;
   * the server always fills it.
   */
  noSystemInstalled?: boolean;
  jobNotesCompleted: boolean;
  requiredQaItemsComplete: boolean;
  customerSignaturePlaceholder: "optional";
  /**
   * The multi-day final-day block, while it stands: the same sentence the
   * completion refusal carries ("this job runs through … and cannot be
   * completed before its final scheduled day"). Null when the job may be
   * completed today. Applies in both closeout modes.
   */
  finalDayBlocker: string | null;
  /**
   * Inventory Lane 4 closeout reconciliation. Optional so older callers and fixtures keep
   * compiling; the server always fills them. `materialsRequired` = a full-closeout job with a
   * confirmed plan that has catalog-linked lines. `materialsReconciled` is also true after an
   * office override. `materialsBlocked` = the stage (soft / hard) currently stops completion.
   */
  materialsRequired?: boolean;
  materialsReconciled?: boolean;
  materialsEnforcement?: "warn" | "soft" | "hard";
  materialsBlocked?: boolean;
  /** The viewer may record an office override (soft stage, owner / manager / office). */
  materialsCanOverride?: boolean;
  /** All gates satisfied and no final-day block — mirrors the server. */
  canComplete: boolean;
}

export const DEFAULT_REQUIRED_QA_CHECKLIST: RequiredQaChecklist = {
  startupVerificationComplete: false,
  safetyReviewComplete: false,
  workAreaCleaned: false,
};

export function normalizeQaChecklist(value: unknown): RequiredQaChecklist {
  if (!value || typeof value !== "object") {
    return DEFAULT_REQUIRED_QA_CHECKLIST;
  }

  const record = value as Record<string, unknown>;

  return {
    startupVerificationComplete: Boolean(record.startupVerificationComplete),
    safetyReviewComplete: Boolean(record.safetyReviewComplete),
    workAreaCleaned: Boolean(record.workAreaCleaned),
  };
}

export function isRequiredQaChecklistComplete(checklist: RequiredQaChecklist): boolean {
  return (
    checklist.startupVerificationComplete &&
    checklist.safetyReviewComplete &&
    checklist.workAreaCleaned
  );
}

const COMPLETION_BLOCKER_LABELS: Record<string, string> = {
  "missing at least one photo": "At least one photo",
  "missing installed systems": "Installed systems",
  "missing job notes": "Job notes",
  "incomplete required qa items": "Required QA items",
  "materials are not reconciled": "Materials reconciled",
};

/**
 * Turns the server's completion rejection into the list of what is still
 * missing. Items are comma-separated, but a comma followed by a digit belongs
 * to a date inside an item ("runs through Nov 4, 2026 …"), so it never splits.
 * Items without a short label (e.g. the multi-day final-day block) are shown
 * as their sentence, capitalized.
 */
export function completionBlockers(message: string): string[] {
  const detail = message.split(/—| - /).slice(1).join("—").trim().replace(/\.$/, "");
  if (!detail || !message.toLowerCase().includes("cannot complete")) return [];
  return detail
    .split(/,(?!\s*\d)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(
      (part) =>
        COMPLETION_BLOCKER_LABELS[part.toLowerCase()] ??
        part.charAt(0).toUpperCase() + part.slice(1),
    );
}

export function parseLatestQaChecklist(activity: JobActivity[]): RequiredQaChecklist {
  const latestQaEvent = [...activity]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .find((item) => item.type === "qa");

  if (!latestQaEvent) {
    return DEFAULT_REQUIRED_QA_CHECKLIST;
  }

  try {
    return normalizeQaChecklist(JSON.parse(latestQaEvent.description));
  } catch {
    return DEFAULT_REQUIRED_QA_CHECKLIST;
  }
}
