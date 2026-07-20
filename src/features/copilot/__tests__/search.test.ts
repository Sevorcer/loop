import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getFallbackSearchRecords } from "../domainData";
import { searchCopilot } from "../search";

describe("searchCopilot grouped results", () => {
  it("returns grouped structured results for entity search", async () => {
    const response = await searchCopilot("Lakeview", undefined, getFallbackSearchRecords());

    expect(response.mode).toBe("structured");
    expect(response.groups.length).toBeGreaterThan(0);
    expect(response.groups.some((group) => group.label === "Properties")).toBe(true);
  });

  it("prioritizes manual results for manual queries", async () => {
    const response = await searchCopilot(
      "find MXZ-SM42 manual",
      undefined,
      getFallbackSearchRecords(),
    );

    expect(response.intent).toBe("manual_lookup");
    expect(response.groups[0]?.domain).toBe("documents");
    expect(response.groups[0]?.items[0]?.sourceLabel).toBe("Installed Systems");
  });

  it("returns navigation deep links for navigation commands", async () => {
    const response = await searchCopilot("go to dispatch", undefined, getFallbackSearchRecords());
    const navItem = response.groups.flatMap((group) => group.items).find((item) => item.href === "/dispatch");

    expect(response.intent).toBe("navigation");
    expect(navItem).toBeDefined();
  });

  it("returns expanded response mode for conversational queries", async () => {
    const response = await searchCopilot(
      "How do I improve dispatch efficiency?",
      undefined,
      getFallbackSearchRecords(),
    );

    expect(response.mode).toBe("expanded");
    expect(response.response).toBeTruthy();
  });
});
