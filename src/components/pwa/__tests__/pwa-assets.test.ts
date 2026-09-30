import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "..", "public");

describe("PWA installability assets", () => {
  it("ships a valid web app manifest with installable fields", () => {
    const manifestPath = join(PUBLIC_DIR, "manifest.webmanifest");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    const sizes = (manifest.icons ?? []).map((icon: { sizes?: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(
      (manifest.icons ?? []).some(
        (icon: { purpose?: string }) => icon.purpose === "maskable"
      )
    ).toBe(true);
  });

  it("ships every icon the manifest references", () => {
    const manifest = JSON.parse(
      readFileSync(join(PUBLIC_DIR, "manifest.webmanifest"), "utf8")
    );
    for (const icon of manifest.icons ?? []) {
      expect(existsSync(join(PUBLIC_DIR, icon.src))).toBe(true);
    }
    expect(existsSync(join(PUBLIC_DIR, "apple-touch-icon.png"))).toBe(true);
  });

  it("service worker has a fetch handler and never caches API traffic", () => {
    const swPath = join(PUBLIC_DIR, "sw.js");
    expect(existsSync(swPath)).toBe(true);

    const sw = readFileSync(swPath, "utf8");
    expect(sw).toContain('addEventListener("fetch"');
    // The /api/ early-return must come before any cache interaction.
    const apiGuard = sw.indexOf('"/api/"');
    const firstCacheUse = sw.indexOf("caches.open");
    expect(apiGuard).toBeGreaterThan(-1);
    expect(firstCacheUse).toBeGreaterThan(-1);
    expect(apiGuard).toBeLessThan(firstCacheUse);
  });
});
