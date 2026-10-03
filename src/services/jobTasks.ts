import {
  createJobTask as createJobTaskRecord,
  deleteJobTask as deleteJobTaskRecord,
  listJobTasks as listJobTasksRecord,
  updateJobTask as updateJobTaskRecord,
  type JobTask, type JobTaskSection,
} from "@/repositories/jobTasks";

export type { JobTask, JobTaskSection };

/** Default checklist the office works through on install jobs. */
export const INSTALL_CHECKLIST_TEMPLATE = [
  "Pull permit & schedule inspection",
  "Register equipment warranty",
  "Enter equipment (model & serial numbers)",
  "Schedule final inspection",
] as const;

export async function listJobTasks(jobId: string) {
  return listJobTasksRecord(jobId);
}

export async function createJobTask(jobId: string, rawLabel: string, section: JobTaskSection = "field") {
  const label = rawLabel.trim();

  if (!label) {
    throw new Error("Checklist item text is required.");
  }

  if (label.length > 200) {
    throw new Error("Checklist item text is too long.");
  }

  const existing = await listJobTasksRecord(jobId);
  const nextSortOrder =
    existing.reduce((max, task) => Math.max(max, task.sortOrder), 0) + 1;

  return createJobTaskRecord({ jobId, label, sortOrder: nextSortOrder, section });
}

export async function setJobTaskDone(taskId: string, isDone: boolean) {
  return updateJobTaskRecord(taskId, { isDone });
}

export async function renameJobTask(taskId: string, rawLabel: string) {
  const label = rawLabel.trim();

  if (!label) {
    throw new Error("Checklist item text is required.");
  }

  return updateJobTaskRecord(taskId, { label });
}

export async function deleteJobTask(taskId: string) {
  return deleteJobTaskRecord(taskId);
}

/**
 * Seeds the install-office template. No-ops (returns the current list) when
 * the job already has tasks, so re-clicking never duplicates items.
 */
export async function applyInstallChecklistTemplate(jobId: string) {
  const existing = await listJobTasksRecord(jobId);

  if (existing.some((task) => task.section === "office")) {
    return existing;
  }

  const created: JobTask[] = [];
  let sortOrder = existing.reduce((max, task) => Math.max(max, task.sortOrder), 0) + 1;

  const newTasks = await Promise.all(
    INSTALL_CHECKLIST_TEMPLATE.map((label) =>
      createJobTaskRecord({
        jobId,
        label,
        sortOrder: sortOrder++,
        section: "office",
      })
    )
  );
  created.push(...newTasks);

  return [...existing, ...created];
}
