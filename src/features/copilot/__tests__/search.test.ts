import { describe, expect, it } from "vitest";

import { searchCopilot } from "../search";

describe("searchCopilot grouped results", () => {
  it("returns grouped structured results for entity search", () => {
    const response = searchCopilot("Lakeview");

    expect(response.mode).toBe("structured");
    expect(response.groups.length).toBeGreaterThan(0);
    expect(response.groups.some((group) => group.label === "Properties")).toBe(true);
  });

  it("prioritizes manual results for manual queries", () => {
    const response = searchCopilot("find MXZ-SM42 manual");

    expect(response.intent).toBe("manual_lookup");
    expect(response.groups[0]?.domain).toBe("documents");
    expect(response.groups[0]?.items[0]?.sourceLabel).toBe("Installed Systems");
  });

  it("returns navigation deep links for navigation commands", () => {
    const response = searchCopilot("go to dispatch");
    const navItem = response.groups.flatMap((group) => group.items).find((item) => item.href === "/dispatch");

    expect(response.intent).toBe("navigation");
    expect(navItem).toBeDefined();
  });

  it("returns expanded response mode for conversational queries", () => {
    const response = searchCopilot("How do I improve dispatch efficiency?");

    expect(response.mode).toBe("expanded");
    expect(response.response).toBeTruthy();
  });
});
