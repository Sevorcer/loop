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
