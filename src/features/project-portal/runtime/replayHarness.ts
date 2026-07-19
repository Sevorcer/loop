import {
  capturePortalCheckpoint,
  type PortalCheckpointStore,
} from "./checkpoints";
import {
  detectDuplicatePortalEvent,
  type PortalIdempotencyStore,
} from "./idempotency";
import {
  defaultPortalRolloutControl,
  type PortalRolloutControl,
  type PortalTelemetrySink,
} from "./rollout";
import { applyPortalEventToProjection } from "./projection";
import { validatePortalEventEnvelope } from "./eventValidation";
import type {
  PortalEventEnvelope,
  PortalEventValidationError,
} from "../types/events";
import type { PortalProjectionState } from "../types/portal";

export interface PortalReplayHarnessOptions {
  checkpointStore: PortalCheckpointStore;
  idempotencyStore: PortalIdempotencyStore;
  telemetry: PortalTelemetrySink;
  rollout?: PortalRolloutControl;
  now?: () => Date;
}

export interface PortalReplayStep {
  eventId: string | null;
  status: "accepted" | "parked" | "rejected" | "duplicate" | "skipped";
  errors: PortalEventValidationError[];
}

export interface PortalReplayResult {
  state: PortalProjectionState;
  steps: PortalReplayStep[];
  parkedEvents: PortalEventEnvelope[];
  rejectedEvents: Array<{ event: PortalEventEnvelope | null; errors: PortalEventValidationError[] }>;
}

export function orderPortalEventsForReplay(
  events: readonly PortalEventEnvelope[]
): PortalEventEnvelope[] {
  return [...events].sort((left, right) => {
    const delta = Date.parse(left.occurred_at) - Date.parse(right.occurred_at);
    if (delta !== 0) {
      return delta;
    }

    return left.idempotency_key.localeCompare(right.idempotency_key);
  });
}

export async function rebuildPortalProjectionFromEvents(
  projectId: string,
  events: readonly PortalEventEnvelope[],
  initialState: PortalProjectionState,
  options: PortalReplayHarnessOptions
): Promise<PortalReplayResult> {
  const rollout = options.rollout ?? defaultPortalRolloutControl;
  const now = options.now ?? (() => new Date());

  if (!rollout.isEnabled("projectionRebuild") || !rollout.isEnabled("ingestion")) {
    return {
      state: initialState,
      steps: [{ eventId: null, status: "skipped", errors: [] }],
      parkedEvents: [],
      rejectedEvents: [],
    };
  }

  let state = initialState;
  const steps: PortalReplayStep[] = [];
  const parkedEvents: PortalEventEnvelope[] = [];
  const rejectedEvents: Array<{
    event: PortalEventEnvelope | null;
    errors: PortalEventValidationError[];
  }> = [];

  for (const candidate of orderPortalEventsForReplay(events)) {
    const validation = validatePortalEventEnvelope(candidate);

    if (validation.status === "rejected") {
      rejectedEvents.push({ event: validation.event, errors: validation.errors });
      steps.push({
        eventId: validation.event?.event_id ?? null,
        status: "rejected",
        errors: validation.errors,
      });
      await options.telemetry.emit({
        name: "portal.event.rejected",
        timestamp: now().toISOString(),
        projectId,
        errorCode: validation.errors[0]?.code,
        metadata: { errors: validation.errors },
      });
      continue;
    }

    if (validation.status === "parked") {
      if (validation.event) {
        parkedEvents.push(validation.event);
      }
      steps.push({
        eventId: validation.event?.event_id ?? null,
        status: "parked",
        errors: validation.errors,
      });
      await options.telemetry.emit({
        name: "portal.event.parked",
        timestamp: now().toISOString(),
        projectId,
        errorCode: validation.errors[0]?.code,
        metadata: { errors: validation.errors },
      });
      continue;
    }

    const dedupe = await detectDuplicatePortalEvent(
      validation.event,
      options.idempotencyStore
    );

    if (dedupe.duplicate) {
      steps.push({
        eventId: validation.event.event_id,
        status: "duplicate",
        errors: dedupe.errors,
      });
      await options.telemetry.emit({
        name: "portal.event.duplicate",
        timestamp: now().toISOString(),
        projectId,
        errorCode: dedupe.errors[0]?.code,
        metadata: { idempotencyKey: validation.event.idempotency_key },
      });
      continue;
    }

    state = applyPortalEventToProjection(state, validation.event, now().toISOString());
    const checkpoint = capturePortalCheckpoint(
      state,
      validation.event.event_id,
      validation.event.idempotency_key,
      now().toISOString()
    );
    await options.checkpointStore.save(checkpoint);
    steps.push({ eventId: validation.event.event_id, status: "accepted", errors: [] });
  }

  const checkpoint = await options.checkpointStore.get(projectId);
  return {
    state: checkpoint?.state ?? state,
    steps,
    parkedEvents,
    rejectedEvents,
  };
}
