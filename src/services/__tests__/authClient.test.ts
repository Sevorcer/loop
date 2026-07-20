/**
 * Tests for isAuthClientConfigured() — verifies that auth is considered
 * configured when the URL + at least one recognised key env var is present,
 * and not configured otherwise.
 *
 * Each test uses vi.resetModules() so that the browser-client singleton is
 * recreated from the env vars active at the time of the dynamic import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Top-level mock — hoisted automatically before any imports
// ---------------------------------------------------------------------------

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ auth: {} })),
}));

// ---------------------------------------------------------------------------
// Env management helpers
// ---------------------------------------------------------------------------

const SUPABASE_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

function setEnv(values: Partial<Record<(typeof SUPABASE_KEYS)[number], string | undefined>>) {
  for (const k of SUPABASE_KEYS) {
    if (k in values) {
      if (values[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = values[k];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear all tracked keys before each test.
  for (const k of SUPABASE_KEYS) {
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isAuthClientConfigured", () => {
  it("returns true when URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
    });

    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(true);
  });

  it("returns true when URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set (ANON key absent)", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-value",
    });

    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(true);
  });

  it("returns true when URL + both keys are set (ANON key takes precedence)", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-value",
    });

    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(true);
  });

  it("returns false when URL is missing", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value" });

    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(false);
  });

  it("returns false when both keys are missing", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" });

    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(false);
  });

  it("returns false when URL and both keys are missing", async () => {
    // All keys already cleared in beforeEach.
    const { isAuthClientConfigured } = await import("@/services/authClient");
    expect(isAuthClientConfigured()).toBe(false);
  });
});
