import "server-only";

import { JOB_PRICE_ACTIVITY_TYPE, jobPriceActivityCopy } from "@/features/jobs/utils/jobPrice";
import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { createJobActivity, getJobById } from "@/repositories/jobs";
import { readJobPrice, writeJobPrice } from "@/repositories/jobPrice";
import type { AppRole } from "@/services/authorization";
import { getCurrentOperator } from "@/services/currentOperator";

function denied(): Error {
  return Object.assign(new Error("You cannot view or change job prices."), { status: 403 });
}

export async function getVisibleJobPrice(jobId: string): Promise<{ visible: boolean; cents: number | null }> {
  const operator = await getCurrentOperator();
  if (!canSeeJobRevenue(operator.appRole)) return { visible: false, cents: null };
  return { visible: true, cents: await readJobPrice(jobId) };
}

export async function getJobPriceForRole(role: AppRole, jobId: string): Promise<number | null> {
  if (!canSeeJobRevenue(role)) throw denied();
  const job = await getJobById(jobId);
  if (!job) throw Object.assign(new Error("Job not found."), { status: 404 });
  return readJobPrice(jobId);
}

export async function setJobPriceForRole(
  role: AppRole,
  jobId: string,
  cents: number | null,
  userId: string | null,
): Promise<number | null> {
  if (!canSeeJobRevenue(role)) throw denied();
  const job = await getJobById(jobId);
  if (!job) throw Object.assign(new Error("Job not found."), { status: 404 });
  const previous = await readJobPrice(jobId);
  if (previous === cents) return cents;
  await writeJobPrice(jobId, cents, userId);
  let actorName = "Someone";
  try {
    const operator = await getCurrentOperator();
    if (operator.name.trim()) actorName = operator.name.trim();
  } catch {
    actorName = "Someone";
  }
  const copy = jobPriceActivityCopy({ previousCents: previous, nextCents: cents, actorName });
  await createJobActivity({
    jobId,
    actorId: userId ?? undefined,
    type: JOB_PRICE_ACTIVITY_TYPE,
    title: copy.title,
    description: copy.description,
  });
  return cents;
}
