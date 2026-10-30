import "server-only";

import { getRepositoryContext } from "./supabaseContext";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("job_financials");
}

function unavailableError(): Error {
  return Object.assign(new Error("Job prices are not ready yet."), { status: 503 });
}

export async function readJobPrice(jobId: string): Promise<number | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_financials")
    .select("revenue_cents")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) {
    if (unavailable(error)) return null;
    throw new Error(error.message);
  }
  const cents = (data as { revenue_cents?: number | string | null } | null)?.revenue_cents;
  if (cents == null) return null;
  const amount = typeof cents === "number" ? cents : Number(cents);
  return Number.isFinite(amount) ? amount : null;
}

export async function writeJobPrice(
  jobId: string,
  cents: number | null,
  userId: string | null,
  previousCents: number | null,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const actor = userId && UUID.test(userId) ? userId : null;
  const saved = await supabase.from("job_financials").upsert(
    {
      org_id: orgId,
      job_id: jobId,
      revenue_cents: cents,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" },
  );
  if (saved.error) {
    if (unavailable(saved.error)) throw unavailableError();
    throw new Error(saved.error.message);
  }
  const history = await supabase.from("job_financials_history").insert({
    org_id: orgId,
    job_id: jobId,
    previous_cents: previousCents,
    revenue_cents: cents,
    changed_by: actor,
  });
  if (history.error) {
    if (unavailable(history.error)) throw unavailableError();
    throw new Error(history.error.message);
  }
}
