import "server-only";

import type { ExpectedArrival } from "@/features/inventory/types/arrivals";
import { validateArrivalCreate, validateArrivalPatch } from "@/features/inventory/utils/arrivalRules";
import {
  getExpectedArrival,
  getShopLocationId,
  insertExpectedArrival,
  listExpectedArrivals,
  rpcReceiveExpectedArrival,
  updateExpectedArrival,
} from "@/repositories/expectedArrivals";

import { reconcileAfterStockChange } from "./inventoryReservations";
import { recomputeReadinessQuietly } from "./readiness";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) badRequest("Send a JSON object.");
  return input as Record<string, unknown>;
}

export async function listArrivals(includeClosed = false): Promise<ExpectedArrival[]> {
  return listExpectedArrivals({ includeClosed });
}

export async function addArrival(input: unknown): Promise<ExpectedArrival> {
  const parsed = validateArrivalCreate(asObject(input));
  if (!parsed.ok) badRequest(parsed.message);
  const locationId = parsed.value.locationId ?? (await getShopLocationId());
  if (!locationId) badRequest("Add a warehouse under Locations before expecting stock.");
  const id = await insertExpectedArrival({ ...parsed.value, locationId });
  await recomputeReadinessQuietly();
  return getExpectedArrival(id);
}

/** Edit an open arrival, or cancel it (it stays as history). */
export async function changeArrival(id: string, input: unknown): Promise<ExpectedArrival> {
  const parsed = validateArrivalPatch(asObject(input));
  if (!parsed.ok) badRequest(parsed.message);
  await updateExpectedArrival(id, parsed.value);
  await recomputeReadinessQuietly();
  return getExpectedArrival(id);
}

/** Posts the ledger receive; stock changed, so waiting jobs are topped up in date order. */
export async function receiveArrival(id: string): Promise<ExpectedArrival> {
  const received = await rpcReceiveExpectedArrival(id);
  await reconcileAfterStockChange([received.itemId]);
  return getExpectedArrival(id);
}
