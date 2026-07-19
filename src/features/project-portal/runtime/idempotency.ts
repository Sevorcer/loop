import type {
  PortalEventEnvelope,
  PortalEventValidationError,
} from "../types/events";

export interface PortalIdempotencyStore {
  has(idempotencyKey: string): Promise<boolean>;
  mark(idempotencyKey: string): Promise<void>;
  values(): Promise<readonly string[]>;
}

export class InMemoryPortalIdempotencyStore implements PortalIdempotencyStore {
  private readonly processedKeys = new Set<string>();

  async has(idempotencyKey: string): Promise<boolean> {
    return this.processedKeys.has(idempotencyKey);
  }

  async mark(idempotencyKey: string): Promise<void> {
    this.processedKeys.add(idempotencyKey);
  }

  async values(): Promise<readonly string[]> {
    return Array.from(this.processedKeys);
  }
}

export interface PortalDeduplicationResult {
  duplicate: boolean;
  errors: PortalEventValidationError[];
}

export async function detectDuplicatePortalEvent(
  event: PortalEventEnvelope,
  store: PortalIdempotencyStore
): Promise<PortalDeduplicationResult> {
  const duplicate = await store.has(event.idempotency_key);

  if (duplicate) {
    return {
      duplicate: true,
      errors: [
        {
          code: "duplicate_event",
          severity: "warn",
          message: "Event acknowledged without reprocessing because the idempotency key has already been processed.",
          field: "idempotency_key",
          details: { idempotencyKey: event.idempotency_key },
        },
      ],
    };
  }

  await store.mark(event.idempotency_key);
  return { duplicate: false, errors: [] };
}
