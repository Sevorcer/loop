import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";

import {
  buildProjection,
  computeFreshness,
  deduplicateEvents,
} from "../adapters/eventProjection";
import { mockEventStream, duplicateMilestoneEvent, MOCK_PROJECT_ID } from "../data/mockEvents";
import type { PortalEventEnvelope, MilestoneCompletedPayload } from "../types/portal";

// ─── computeFreshness ─────────────────────────────────────────────────────────

describe("computeFreshness", () => {
  const FIXED_NOW = "2026-07-19T12:00:00.000Z";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns 'fresh' when last sync was less than 5 minutes ago", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    const result = computeFreshness(twoMinAgo);
    expect(result.state).toBe("fresh");
    expect(result.minutesSinceSync).toBeLessThan(5);
  });

  it("returns 'stale_warning' when last sync was 5–14 minutes ago", () => {
    const eightMinAgo = new Date(Date.now() - 8 * 60_000).toISOString();
    const result = computeFreshness(eightMinAgo);
    expect(result.state).toBe("stale_warning");
  });

  it("returns 'stale_elevated' when last sync was 15+ minutes ago", () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    const result = computeFreshness(twentyMinAgo);
    expect(result.state).toBe("stale_elevated");
  });

  it("includes correct minutesSinceSync value", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const result = computeFreshness(tenMinAgo);
    expect(result.minutesSinceSync).toBe(10);
  });
});

// ─── deduplicateEvents ────────────────────────────────────────────────────────

describe("deduplicateEvents", () => {
  const event1: PortalEventEnvelope<MilestoneCompletedPayload> = {
    event_id: "evt-001",
    event_version: "1.0",
    event_type: "milestone.completed",
    occurred_at: "2026-07-01T10:00:00.000Z",
    source_domain: "jobs",
    aggregate_id: "proj-001",
    idempotency_key: "jobs:milestone.completed:proj-001:2026-07-01T10:00:00.000Z",
    payload: {
      milestone_id: "ms-001",
      milestone_name: "Estimate Approved",
      milestone_sequence: 1,
      completed_by: "Alice",
      notes_for_portal: "Test",
      project_id: "proj-001",
    },
  };

  const event2: PortalEventEnvelope<MilestoneCompletedPayload> = {
    ...event1,
    event_id: "evt-002",
    occurred_at: "2026-07-02T10:00:00.000Z",
    idempotency_key: "jobs:milestone.completed:proj-001:2026-07-02T10:00:00.000Z",
    payload: { ...event1.payload, milestone_name: "Permit Submitted", milestone_sequence: 2 },
  };

  it("returns both events when key store is empty", () => {
    const { novelEvents, newKeys } = deduplicateEvents(
      [event1, event2],
      new Set(),
    );
    expect(novelEvents).toHaveLength(2);
    expect(newKeys.size).toBe(2);
  });

  it("filters out an event whose idempotency_key is already in the store", () => {
    const alreadyProcessed = new Set([event1.idempotency_key]);
    const { novelEvents } = deduplicateEvents([event1, event2], alreadyProcessed);
    expect(novelEvents).toHaveLength(1);
    expect(novelEvents[0].idempotency_key).toBe(event2.idempotency_key);
  });

  it("processing the same event twice does not duplicate the key store entry", () => {
    const { newKeys: afterFirst } = deduplicateEvents([event1], new Set());
    const { novelEvents: afterSecond } = deduplicateEvents([event1], afterFirst);
    expect(afterSecond).toHaveLength(0);
  });

  it("deduplicates using idempotency_key, not event_id", () => {
    // Same idempotency_key, different event_id (replay scenario)
    const replayEvent = { ...event1, event_id: "evt-replay-999" };
    const { novelEvents } = deduplicateEvents(
      [replayEvent],
      new Set([event1.idempotency_key]),
    );
    expect(novelEvents).toHaveLength(0);
  });
});

// ─── buildProjection ─────────────────────────────────────────────────────────

describe("buildProjection", () => {
  it("processes all 4 event types from the mock stream", () => {
    const syncedAt = new Date().toISOString();
    const result = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: syncedAt,
    });
    expect(result.timeline!.entries.length).toBeGreaterThan(0);
    expect(result.appointments.length).toBeGreaterThan(0);
    expect(result.changeOrders.length).toBeGreaterThan(0);
    expect(result.documents!.documents.length).toBeGreaterThan(0);
  });

  it("timeline entries are in chronological order (by occurred_at)", () => {
    const result = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    });
    const entries = result.timeline!.entries;
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].completedAt >= entries[i - 1].completedAt).toBe(true);
    }
  });

  it("filters out internal documents — only customer-visible docs appear", () => {
    const result = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    });
    const docs = result.documents!.documents;
    docs.forEach((doc) => {
      expect(doc.visibility).toBe("customer");
    });
    // The mock stream has 1 internal doc that should be filtered out
    expect(docs.find((d) => d.id === "doc-internal-uuid")).toBeUndefined();
  });

  it("does not process events for a different project", () => {
    const result = buildProjection({
      projectId: "proj-different-uuid",
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    });
    expect(result.timeline!.entries).toHaveLength(0);
    expect(result.appointments).toHaveLength(0);
    expect(result.documents!.documents).toHaveLength(0);
  });

  it("idempotency: processing the same event stream twice produces the same result", () => {
    const opts = {
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    };
    const first = buildProjection(opts);
    // Second pass uses the processed keys from the first pass
    const second = buildProjection({
      ...opts,
      processedKeys: first.processedKeys,
    });
    expect(second.timeline!.entries).toHaveLength(0);
    expect(second.documents!.documents).toHaveLength(0);
  });

  it("duplicate event (same idempotency_key) is deduplicated and not added twice", () => {
    const streamWithDuplicate = [...mockEventStream, duplicateMilestoneEvent];
    const result = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: streamWithDuplicate,
      lastSynchronizedAt: new Date().toISOString(),
    });
    // Get original result without duplicate
    const originalResult = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    });
    // Both should have the same timeline entry count
    expect(result.timeline!.entries).toHaveLength(
      originalResult.timeline!.entries.length,
    );
  });

  it("skips events with unknown future major version (v2.0+)", () => {
    const futureVersionEvent: PortalEventEnvelope<MilestoneCompletedPayload> = {
      event_id: "evt-future-001",
      event_version: "2.0",
      event_type: "milestone.completed",
      occurred_at: "2026-07-25T10:00:00.000Z",
      source_domain: "jobs",
      aggregate_id: MOCK_PROJECT_ID,
      idempotency_key: `jobs:milestone.completed:${MOCK_PROJECT_ID}:2026-07-25T10:00:00.000Z`,
      payload: {
        milestone_id: "ms-future",
        milestone_name: "Future Milestone",
        milestone_sequence: 99,
        completed_by: "Future PM",
        notes_for_portal: "Future event",
        project_id: MOCK_PROJECT_ID,
      },
    };
    const original = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: mockEventStream,
      lastSynchronizedAt: new Date().toISOString(),
    });
    const withFuture = buildProjection({
      projectId: MOCK_PROJECT_ID,
      events: [...mockEventStream, futureVersionEvent],
      lastSynchronizedAt: new Date().toISOString(),
    });
    expect(withFuture.timeline!.entries).toHaveLength(
      original.timeline!.entries.length,
    );
  });
});
