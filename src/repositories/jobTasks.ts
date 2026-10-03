import "server-only";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job checklist tasks (job_tasks) — per-job office checklist items such as
// "Pull permit", "Register warranty", "Enter equipment". Seeded from the
// install template or added ad hoc from the job detail sidebar.
//
// Follows the repositories/jobs.ts convention: throw on error (the API layer
// maps thrown errors via mapRouteError).
// ---------------------------------------------------------------------------

export type JobTaskSection = "field" | "office"; interface JobTaskRow {
  id: string;
  job_id: string;
  label: string;
  is_done: boolean; section: string;
  sort_order: number;
  created_at: string;
  updated_at: string;   completed_at: string | null;   completed_by: string | null;
}

export interface JobTask {
  id: string;
  jobId: string;
  label: string;
  isDone: boolean; section: JobTaskSection;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;   completedAt: string | null;   completedBy: string | null;
}

const JOB_TASK_COLUMNS =
  "id,job_id,label,is_done,sort_order,section,created_at,updated_at,completed_at,completed_by";

function mapJobTask(row: JobTaskRow): JobTask {
  return {
    id: row.id,
    jobId: row.job_id,
    label: row.label,
    isDone: row.is_done, section: row.section === "office" ? "office" : "field",
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at, completedAt: row.completed_at ?? null, completedBy: row.completed_by ?? null,
  };
}

export async function listJobTasks(
  jobId: string,
  options?: { page?: number; pageSize?: number },
): Promise<JobTask[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_tasks")
    .select(JOB_TASK_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapJobTask(row as JobTaskRow));
}

export async function createJobTask(input: {
  jobId: string;
  label: string;
  sortOrder?: number; section?: JobTaskSection;
}): Promise<JobTask> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_tasks")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      label: input.label, section: input.section ?? "field",
      sort_order: input.sortOrder ?? 0,
    })
    .select(JOB_TASK_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapJobTask(data as JobTaskRow);
}

export async function updateJobTask(
  taskId: string,
  input: { label?: string; isDone?: boolean },
): Promise<JobTask> {
  const { supabase, orgId } = await getRepositoryContext();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.label !== undefined) patch.label = input.label;
  if (input.isDone !== undefined) { patch.is_done = input.isDone; patch.completed_at = input.isDone ? new Date().toISOString() : null; patch.completed_by = input.isDone ? ((await getRepositoryContext()).userId ?? null) : null; }

  const { data, error } = await supabase
    .from("job_tasks")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", taskId)
    .select(JOB_TASK_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job task not found.");
  return mapJobTask(data as JobTaskRow);
}

export async function deleteJobTask(taskId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_tasks")
    .delete()
    .eq("org_id", orgId)
    .eq("id", taskId);

  if (error) throw new Error(error.message);
}
