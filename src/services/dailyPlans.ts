import "server-only";

import {
  loadDailyPlansState,
  markDailyPlanPacketsSent,
  upsertDailyPlanActivation,
  upsertDailyPlanJobOverride,
  upsertDailyPlanNote,
  type DailyPlansState,
} from "@/repositories/dailyPlans";
import { wrapRepositoryError } from "@/repositories/shared";

export async function getDailyPlansState(): Promise<DailyPlansState> {
  return loadDailyPlansState();
}

export async function saveNote(date: string, content: string) {
  return wrapRepositoryError(() => upsertDailyPlanNote(date, content).then((r) => {
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  }));
}

export async function activatePlan(date: string) {
  return upsertDailyPlanActivation(date, "active", new Date().toISOString());
}

export async function setJobOverride(
  jobId: string,
  readinessState: "ready" | "needs-attention" | undefined
) {
  return upsertDailyPlanJobOverride(jobId, readinessState);
}

export async function markPacketsSent(date: string) {
  return markDailyPlanPacketsSent(date);
}
