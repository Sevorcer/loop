import "server-only";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

export interface JobCallbackRow {
  job_id: string;
  original_job_id: string;
  reason: string;
}

const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listJobCallbackRows(
  jobId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<JobCallbackRow[]> {
  if (!JOB_ID_PATTERN.test(jobId)) return [];
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_callbacks")
    .select("job_id,original_job_id,reason")
    .eq("org_id", orgId)
    .or(`job_id.eq.${jobId},original_job_id.eq.${jobId}`);

  if (error) throw new Error(error.message);
  return (data ?? []) as JobCallbackRow[];
}

export async function insertJobCallback(
  input: {
    jobId: string;
    originalJobId: string;
    reason: string;
    createdBy: string | null;
  },
  contextInput?: SessionRepositoryContextInput,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { error } = await supabase.from("job_callbacks").insert({
    org_id: orgId,
    job_id: input.jobId,
    original_job_id: input.originalJobId,
    reason: input.reason,
    created_by: input.createdBy,
  });
  if (error) throw new Error(error.message);
}
