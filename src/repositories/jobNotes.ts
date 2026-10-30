import "server-only";

import type { JobNote } from "@/features/jobs/types/jobNote";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

interface JobNoteRow {
  id: string;
  job_id: string;
  body: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  created_at: string;
}

function mapJobNote(row: JobNoteRow): JobNote {
  return {
    id: row.id,
    jobId: row.job_id,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
  };
}

const JOB_NOTE_COLUMNS =
  "id,job_id,body,author_id,author_name,author_role,created_at";

export async function listJobNotes(
  jobId: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<JobNote[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_notes")
    .select(JOB_NOTE_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as JobNoteRow[]).map(mapJobNote);
}

export async function insertJobNote(
  input: {
    jobId: string;
    body: string;
    authorId?: string | null;
    authorName: string;
    authorRole: string;
  },
  contextInput?: SessionRepositoryContextInput,
): Promise<JobNote> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_notes")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      body: input.body,
      author_id: input.authorId ?? null,
      author_name: input.authorName,
      author_role: input.authorRole,
    })
    .select(JOB_NOTE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapJobNote(data as JobNoteRow);
}
