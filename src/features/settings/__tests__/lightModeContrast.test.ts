import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("light mode contrast tokens", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const lightBlock = css.slice(css.indexOf('[data-color-mode="light"]'));

  it("uses dark text on a light page", () => {
    expect(lightBlock).toContain("--foreground: #0f172a");
    expect(lightBlock).toContain("--background: #f1f5f9");
    expect(lightBlock).toContain("--foreground-muted: #334155");
    expect(lightBlock).toContain(".text-white");
  });
});
