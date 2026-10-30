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
  photosUploaded: boolean;
  installedSystemsEntered: boolean;
  jobNotesCompleted: boolean;
  requiredQaItemsComplete: boolean;
  customerSignaturePlaceholder: "optional";
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
};

/** Turns the server's completion rejection into the list of what is still missing. */
export function completionBlockers(message: string): string[] {
  const detail = message.split(/—| - /).slice(1).join("—").trim().replace(/\.$/, "");
  if (!detail || !message.toLowerCase().includes("cannot complete")) return [];
  return detail
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => COMPLETION_BLOCKER_LABELS[part.toLowerCase()] ?? part);
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
