/**
 * Portal projection idempotency and event processing tests.
 *
 * Verifies that the canonical event fixtures are correctly structured
 * and that idempotency key construction is deterministic.
 */

import { mockPortalEvents } from "../data/mockPortalEvents";

// ─── Event Envelope Validation ────────────────────────────────────────────────

describe("Portal event fixtures — canonical envelope compliance", () => {
  const REQUIRED_FIELDS = [
    "event_id",
    "event_version",
    "event_type",
    "occurred_at",
    "source_domain",
    "aggregate_id",
    "idempotency_key",
    "payload",
  ];

  it("all events contain all required envelope fields", () => {
    for (const event of mockPortalEvents) {
      for (const field of REQUIRED_FIELDS) {
        expect(event).toHaveProperty(field);
        expect((event as Record<string, unknown>)[field]).not.toBeNull();
        expect((event as Record<string, unknown>)[field]).not.toBeUndefined();
      }
    }
  });

  it("all event_ids are unique (no duplicates)", () => {
    const ids = mockPortalEvents.map((e) => e.event_id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all idempotency_keys are unique (no duplicates)", () => {
    const keys = mockPortalEvents.map((e) => e.idempotency_key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("idempotency keys follow the canonical format: <source_domain>:<event_type>:<aggregate_id>:<occurred_at>", () => {
    for (const event of mockPortalEvents) {
      const expectedKey = `${event.source_domain}:${event.event_type}:${event.aggregate_id}:${event.occurred_at}`;
      expect(event.idempotency_key).toBe(expectedKey);
    }
  });

  it("all event versions are 1.0", () => {
    for (const event of mockPortalEvents) {
      expect(event.event_version).toBe("1.0");
    }
  });

  it("occurred_at timestamps are valid ISO-8601 UTC timestamps", () => {
    for (const event of mockPortalEvents) {
      const date = new Date(event.occurred_at);
      expect(date.toISOString()).toBe(event.occurred_at);
    }
  });

  it("payload is always an object (never null or primitive)", () => {
    for (const event of mockPortalEvents) {
      expect(typeof event.payload).toBe("object");
      expect(event.payload).not.toBeNull();
    }
  });
});

// ─── Sprint 22B Event Types ────────────────────────────────────────────────────

describe("Sprint 22B event types present in fixtures", () => {
  it("has at least one photo.uploaded event", () => {
    const photoEvents = mockPortalEvents.filter((e) => e.event_type === "photo.uploaded");
    expect(photoEvents.length).toBeGreaterThan(0);
  });

  it("has at least one notification.preference.updated event", () => {
    const prefEvents = mockPortalEvents.filter((e) => e.event_type === "notification.preference.updated");
    expect(prefEvents.length).toBeGreaterThan(0);
  });

  it("photo.uploaded events include required payload fields", () => {
    const photoEvents = mockPortalEvents.filter((e) => e.event_type === "photo.uploaded");
    for (const event of photoEvents) {
      expect(event.payload).toHaveProperty("photo_id");
      expect(event.payload).toHaveProperty("project_id");
      expect(event.payload).toHaveProperty("category");
      expect(event.payload).toHaveProperty("visibility");
      expect(event.payload).toHaveProperty("uploaded_at");
    }
  });
});

// ─── Idempotency Simulation ───────────────────────────────────────────────────

describe("Event deduplication (idempotency)", () => {
  it("duplicate event (same idempotency key) is not processed twice", () => {
    const processedKeys = new Set<string>();
    const results: string[] = [];

    function processEvent(event: typeof mockPortalEvents[number]) {
      if (processedKeys.has(event.idempotency_key)) {
        return; // duplicate — skip
      }
      processedKeys.add(event.idempotency_key);
      results.push(event.event_id);
    }

    // Process all events normally
    for (const event of mockPortalEvents) {
      processEvent(event);
    }

    const normalCount = results.length;

    // Process all events again (simulating replay)
    for (const event of mockPortalEvents) {
      processEvent(event);
    }

    // No additional processing should have occurred
    expect(results).toHaveLength(normalCount);
  });

  it("replay with new event_ids but same idempotency keys does not reprocess", () => {
    const processedKeys = new Set<string>();
    let processCount = 0;

    function processEvent(idempotencyKey: string) {
      if (processedKeys.has(idempotencyKey)) return;
      processedKeys.add(idempotencyKey);
      processCount++;
    }

    // First pass
    for (const event of mockPortalEvents) {
      processEvent(event.idempotency_key);
    }
    const firstPassCount = processCount;

    // Replay with same idempotency keys but "new" event_ids
    for (const event of mockPortalEvents) {
      processEvent(event.idempotency_key);
    }

    // Count should not increase during replay
    expect(processCount).toBe(firstPassCount);
  });
});
