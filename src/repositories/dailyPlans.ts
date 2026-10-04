import "server-only";

import type { DailyPlanActivation, DailyPlanJobOverride, DailyPlanNote } from "@/features/daily-plans/types/dailyPlan";

import { wrapRepositoryError } from "./shared";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface NoteRow {
  id: string;
  org_id: string;
  date: string;
  content: string;
  updated_at: string;
}

interface ActivationRow {
  id: string;
  org_id: string;
  date: string;
  status: "planning" | "active" | "completed";
  started_at: string | null;
  packets_sent: boolean;
  updated_at: string;
}

interface OverrideRow {
  id: string;
  org_id: string;
  job_id: string;
  readiness_state: "ready" | "needs-attention" | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapNote(row: NoteRow): DailyPlanNote {
  return {
    date: row.date,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

function mapActivation(row: ActivationRow): DailyPlanActivation & { packetsSent: boolean } {
  return {
    date: row.date,
    status: row.status,
    startedAt: row.started_at ?? row.date,
    packetsSent: row.packets_sent,
  };
}

function mapOverride(row: OverrideRow): { jobId: string } & DailyPlanJobOverride {
  return {
    jobId: row.job_id,
    readinessState: row.readiness_state ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function getDailyPlanNote(date: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_notes")
      .select("id,org_id,date,content,updated_at")
      .eq("org_id", orgId)
      .eq("date", date)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapNote(data as NoteRow) : null;
  });
}

export async function upsertDailyPlanNote(date: string, content: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_notes")
      .upsert(
        { org_id: orgId, date, content, updated_at: new Date().toISOString() },
        { onConflict: "org_id,date" }
      )
      .select("id,org_id,date,content,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapNote(data as NoteRow);
  });
}

// ---------------------------------------------------------------------------
// Activations
// ---------------------------------------------------------------------------

export async function getDailyPlanActivation(date: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_activations")
      .select("id,org_id,date,status,started_at,packets_sent,updated_at")
      .eq("org_id", orgId)
      .eq("date", date)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapActivation(data as ActivationRow) : null;
  });
}

export async function listDailyPlanActivations(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_activations")
      .select("id,org_id,date,status,started_at,packets_sent,updated_at")
      .eq("org_id", orgId)
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as ActivationRow[]).map(mapActivation);
  });
}

export async function upsertDailyPlanActivation(
  date: string,
  status: "planning" | "active" | "completed",
  startedAt?: string,
  packetsSent?: boolean
) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_activations")
      .upsert(
        {
          org_id: orgId,
          date,
          status,
          started_at: startedAt ?? null,
          packets_sent: packetsSent ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,date" }
      )
      .select("id,org_id,date,status,started_at,packets_sent,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapActivation(data as ActivationRow);
  });
}

export async function markDailyPlanPacketsSent(date: string) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_activations")
      .upsert(
        {
          org_id: orgId,
          date,
          status: "active",
          packets_sent: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,date", ignoreDuplicates: false }
      )
      .select("id,org_id,date,status,started_at,packets_sent,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapActivation(data as ActivationRow);
  });
}

// ---------------------------------------------------------------------------
// Job overrides
// ---------------------------------------------------------------------------

export async function listDailyPlanJobOverrides(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_job_overrides")
      .select("id,org_id,job_id,readiness_state,updated_at")
      .eq("org_id", orgId)
      .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as OverrideRow[]).map(mapOverride);
  });
}

export async function upsertDailyPlanJobOverride(
  jobId: string,
  readinessState: "ready" | "needs-attention" | undefined
) {
  return wrapRepositoryError(async () => {
    const { supabase, orgId } = await getRepositoryContext();
    const { data, error } = await supabase
      .from("daily_plan_job_overrides")
      .upsert(
        {
          org_id: orgId,
          job_id: jobId,
          readiness_state: readinessState ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,job_id" }
      )
      .select("id,org_id,job_id,readiness_state,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return mapOverride(data as OverrideRow);
  });
}

// ---------------------------------------------------------------------------
// Bulk load — returns all state for the provider in a single round-trip
// ---------------------------------------------------------------------------

export interface DailyPlansState {
  notes: Record<string, DailyPlanNote>;
  activations: Record<string, DailyPlanActivation & { packetsSent: boolean }>;
  jobOverrides: Record<string, DailyPlanJobOverride>;
}

export async function loadDailyPlansState(): Promise<DailyPlansState> {
  const { supabase, orgId } = await getRepositoryContext();

  const [notesRes, activationsRes, overridesRes] = await Promise.all([
    supabase
      .from("daily_plan_notes")
      .select("id,org_id,date,content,updated_at")
      .eq("org_id", orgId),
    supabase
      .from("daily_plan_activations")
      .select("id,org_id,date,status,started_at,packets_sent,updated_at")
      .eq("org_id", orgId),
    supabase
      .from("daily_plan_job_overrides")
      .select("id,org_id,job_id,readiness_state,updated_at")
      .eq("org_id", orgId),
  ]);

  if (notesRes.error) throw new Error(notesRes.error.message);
  if (activationsRes.error) throw new Error(activationsRes.error.message);
  if (overridesRes.error) throw new Error(overridesRes.error.message);

  const notes: Record<string, DailyPlanNote> = {};
  for (const row of (notesRes.data ?? []) as NoteRow[]) {
    notes[row.date] = mapNote(row);
  }

  const activations: Record<string, DailyPlanActivation & { packetsSent: boolean }> = {};
  for (const row of (activationsRes.data ?? []) as ActivationRow[]) {
    activations[row.date] = mapActivation(row);
  }

  const jobOverrides: Record<string, DailyPlanJobOverride> = {};
  for (const row of (overridesRes.data ?? []) as OverrideRow[]) {
    jobOverrides[row.job_id] = { readinessState: row.readiness_state ?? undefined };
  }

  return { notes, activations, jobOverrides };
}
