import {
  createJobTask as createJobTaskRecord,
  deleteJobTask as deleteJobTaskRecord,
  listJobTasks as listJobTasksRecord,
  updateJobTask as updateJobTaskRecord,
  type JobTask,
} from "@/repositories/jobTasks";

export type { JobTask };

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

export async function createJobTask(jobId: string, rawLabel: string) {
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

  return createJobTaskRecord({ jobId, label, sortOrder: nextSortOrder });
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

  if (existing.length > 0) {
    return existing;
  }

  const created: JobTask[] = [];
  let sortOrder = 1;

  for (const label of INSTALL_CHECKLIST_TEMPLATE) {
    created.push(
      await createJobTaskRecord({
        jobId,
        label,
        sortOrder: sortOrder++,
      }),
    );
  }

  return created;
}
