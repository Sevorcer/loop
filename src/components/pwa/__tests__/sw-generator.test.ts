import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The generator is plain ESM under scripts/; import its pure helpers directly.
import { resolveBuildId, renderServiceWorker } from "../../../../scripts/generate-sw.mjs";

const TEMPLATE_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "scripts",
  "sw.template.js"
);

describe("service worker build-id generator", () => {
  it("derives the build id from the Vercel commit sha", () => {
    const id = resolveBuildId({ VERCEL_GIT_COMMIT_SHA: "abc123DEF4567890feedface" });
    // Lowercased and truncated to a short, cache-key-safe segment.
    expect(id).toBe("abc123def456");
  });

  it("sanitises an explicit override to [a-z0-9]", () => {
    expect(resolveBuildId({ LOOP_BUILD_ID: "Hot-Fix_99!!" })).toBe("hotfix99");
  });

  it("falls back to a stable 'dev' id when no build env is present", () => {
    expect(resolveBuildId({})).toBe("dev");
  });

  it("prefers the Vercel sha over an explicit override", () => {
    expect(
      resolveBuildId({ VERCEL_GIT_COMMIT_SHA: "deadbeef", LOOP_BUILD_ID: "ignored" })
    ).toBe("deadbeef");
  });

  it("bakes the build id into a versioned cache name and removes the token", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const output = renderServiceWorker(template, "abc123def456");

    expect(output).toContain('const CACHE_VERSION = "loop-pwa-abc123def456";');
    expect(output).not.toContain("__LOOP_BUILD_ID__");
  });

  it("produces different cache names for different builds (purge triggers on deploy)", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const a = renderServiceWorker(template, "buildaaa");
    const b = renderServiceWorker(template, "buildbbb");

    expect(a).toContain('"loop-pwa-buildaaa"');
    expect(b).toContain('"loop-pwa-buildbbb"');
    expect(a).not.toBe(b);
  });

  it("refuses to generate an unversioned worker when the token is missing", () => {
    expect(() => renderServiceWorker("const CACHE_VERSION = 'loop-pwa-v1';", "x")).toThrow();
  });

  it("preserves the API-never-cache invariant in generated output", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");
    const output = renderServiceWorker(template, "deadbeef");

    // The /api/ early-return must still precede any contiguous cache interaction.
    const apiGuard = output.indexOf('"/api/"');
    const firstCacheUse = output.indexOf("caches.open");
    expect(apiGuard).toBeGreaterThan(-1);
    expect(firstCacheUse).toBeGreaterThan(-1);
    expect(apiGuard).toBeLessThan(firstCacheUse);
  });
});
