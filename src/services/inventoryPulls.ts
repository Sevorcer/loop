import "server-only";

import type { MaterialEventInput, PullQueueJob, PullResult, ReturnPalletResult, StrandedPallet } from "@/features/inventory/types/pulls";
import { validateMaterialEvent } from "@/features/inventory/utils/materialEventRules";
import {
  insertMaterialEvent,
  listPullQueueJobs,
  listStrandedPallets,
  rpcPullJobMaterials,
  rpcReturnPalletToShop,
} from "@/repositories/inventoryPulls";

import { reconcileAfterStockChange } from "./inventoryReservations";
import { recomputeReadinessQuietly } from "./readiness";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

export async function getPullQueue(): Promise<{ jobs: PullQueueJob[]; stranded: StrandedPallet[] }> {
  const [jobs, stranded] = await Promise.all([listPullQueueJobs(), listStrandedPallets()]);
  return { jobs, stranded };
}

/** One job's lines for the printable pull list; null when it has nothing staged or reserved. */
export async function getPullList(jobId: string): Promise<PullQueueJob | null> {
  const [job] = await listPullQueueJobs(jobId);
  return job ?? null;
}

/** Pull a whole job, or one line of it. Stock moves shop -> pallet; readiness is refreshed. */
export async function pullMaterials(jobId: string, lineId: string | null): Promise<PullResult> {
  const result = await rpcPullJobMaterials(jobId, lineId);
  await recomputeReadinessQuietly();
  return result;
}

/** A cancelled job's pallet goes back to the shop; waiting jobs are topped up with it. */
export async function returnPallet(jobId: string, note: string | null): Promise<ReturnPalletResult> {
  const result = await rpcReturnPalletToShop(jobId, note);
  await reconcileAfterStockChange(result.returned.map((row) => row.itemId));
  return result;
}

/** Missing / wrong part, substitution, "Bought on the way", kit feedback. Capture only. */
export async function recordMaterialEvent(jobId: string, body: unknown): Promise<MaterialEventInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) badRequest("Send a JSON object.");
  const parsed = validateMaterialEvent(body as Record<string, unknown>);
  if (!parsed.ok) badRequest(parsed.message);
  await insertMaterialEvent(jobId, parsed.value);
  return parsed.value;
}
