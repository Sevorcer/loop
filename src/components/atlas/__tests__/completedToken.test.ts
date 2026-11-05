import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("completed (pink) design token", () => {
  it("defines --completed for dark and light modes", () => {
    const matches = css.match(/--completed:\s*#[0-9a-fA-F]{6};/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("exposes the utilities components consume instead of raw palette colors", () => {
    for (const cls of [".status-completed", ".completed-card", ".completed-tint", ".completed-text", ".completed-dot"]) {
      expect(css).toContain(cls);
    }
  });

  it("never dims completed cards", () => {
    const block = css.slice(css.indexOf(".completed-card"), css.indexOf(".completed-tint"));
    expect(block).not.toContain("opacity");
  });
});
