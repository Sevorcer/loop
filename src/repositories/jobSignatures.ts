import "server-only";

import type { JobSignature } from "@/features/jobs/types/jobSignature";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

interface JobSignatureRow {
  id: string;
  job_id: string;
  storage_object_id: string;
  signer_name: string;
  captured_by_name: string;
  captured_by_role: string;
  captured_at: string;
}

function mapJobSignature(row: JobSignatureRow, previewUrl: string | null): JobSignature {
  return {
    id: row.id,
    jobId: row.job_id,
    signerName: row.signer_name,
    capturedByName: row.captured_by_name,
    capturedByRole: row.captured_by_role,
    capturedAt: row.captured_at,
    previewUrl,
  };
}

const JOB_SIGNATURE_COLUMNS =
  "id,job_id,storage_object_id,signer_name,captured_by_name,captured_by_role,captured_at";

export async function listJobSignatures(
  jobId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<Array<JobSignatureRow>> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_signatures")
    .select(JOB_SIGNATURE_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("captured_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as JobSignatureRow[];
}

export async function insertJobSignature(
  input: {
    jobId: string;
    storageObjectId: string;
    signerName: string;
    capturedBy: string | null;
    capturedByName: string;
    capturedByRole: string;
  },
  contextInput?: SessionRepositoryContextInput,
): Promise<JobSignatureRow> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_signatures")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      storage_object_id: input.storageObjectId,
      signer_name: input.signerName,
      captured_by: input.capturedBy,
      captured_by_name: input.capturedByName,
      captured_by_role: input.capturedByRole,
    })
    .select(JOB_SIGNATURE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as JobSignatureRow;
}

export function toJobSignature(row: JobSignatureRow, previewUrl: string | null): JobSignature {
  return mapJobSignature(row, previewUrl);
}
