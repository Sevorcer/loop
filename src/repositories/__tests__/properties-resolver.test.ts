/**
 * Regression tests: resolvePropertyIdByName duplicate-name safety
 *
 * The resolver used to end its query with .maybeSingle(), so an org with two
 * property rows sharing one name (plausible after the Service Fusion import)
 * made PostgREST throw "JSON object requested, multiple (or no) rows
 * returned" — breaking job create/update/status flows that resolve the
 * property by name for counter syncs. The resolver now mirrors
 * resolveCustomerIdByName: it reads up to two matches and only returns an id
 * when exactly one row matches.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Hoisted mock setup – must use vi.hoisted so mocks are available before
// the module-level vi.mock() calls that run at hoist time.
// ---------------------------------------------------------------------------

const { mockGetRepositoryContext, limitMock } = vi.hoisted(() => {
  // resolvePropertyIdByName awaits .select().eq().eq().limit(2).
  const limitMock = vi.fn();

  const eqChain: {
    eq: () => typeof eqChain;
    limit: typeof limitMock;
  } = {
    eq: () => eqChain,
    limit: limitMock,
  };

  const selectFn = vi.fn(() => eqChain);
  const fromFn = vi.fn(() => ({ select: selectFn }));
  const supabaseMock = { from: fromFn };

  return {
    mockGetRepositoryContext: vi.fn().mockResolvedValue({
      supabase: supabaseMock,
      orgId: "org-test",
    }),
    limitMock,
  };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: mockGetRepositoryContext,
}));

import { resolvePropertyIdByName } from "@/repositories/properties";

describe("resolvePropertyIdByName", () => {
  beforeEach(() => {
    limitMock.mockReset();
  });

  it("returns the id when exactly one property matches the name", async () => {
    limitMock.mockResolvedValue({ data: [{ id: "prop-1" }], error: null });

    await expect(resolvePropertyIdByName("730 Belmont Pl E")).resolves.toBe("prop-1");
  });

  it("resolves null instead of throwing when two properties share the name", async () => {
    limitMock.mockResolvedValue({
      data: [{ id: "prop-1" }, { id: "prop-2" }],
      error: null,
    });

    await expect(resolvePropertyIdByName("730 Belmont Pl E")).resolves.toBeNull();
  });

  it("resolves null when no property matches the name", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    await expect(resolvePropertyIdByName("Nowhere")).resolves.toBeNull();
  });

  it("resolves null for an empty name without querying", async () => {
    await expect(resolvePropertyIdByName("")).resolves.toBeNull();
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("still throws on a real query error", async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: "connection failed" } });

    await expect(resolvePropertyIdByName("730 Belmont Pl E")).rejects.toThrow("connection failed");
  });
});
