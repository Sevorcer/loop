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

  it("returns cross-entity results for Smith lookup", async () => {
    const response = await searchCopilot("Smith", undefined, getFallbackSearchRecords());
    const domains = new Set(response.groups.map((group) => group.domain));

    expect(domains.has("customers")).toBe(true);
    expect(domains.has("properties")).toBe(true);
    expect(domains.has("jobs")).toBe(true);
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

  it("returns operational Mitsubishi matches across jobs, properties, systems, and knowledge", async () => {
    const records = [
      ...getFallbackSearchRecords(),
      {
        id: "system-mitsubishi-1",
        title: "Smith Hyper-Heat System",
        subtitle: "Smith Residence • Active",
        domain: "installed_systems" as const,
        sourceLabel: "Installed Systems",
        href: "/installed-systems/1",
        metadata: {
          badges: ["Mitsubishi", "MXZ-3C24NAHZ2"],
          status: "Active",
          timestamp: "2026-07-10",
        },
        tokens: ["Smith", "Mitsubishi", "MXZ-3C24NAHZ2", "SN-1234"],
        recordType: "entity" as const,
      },
    ];
    const response = await searchCopilot("Mitsubishi", undefined, records);
    const domains = new Set(response.groups.map((group) => group.domain));

    expect(domains.has("jobs")).toBe(true);
    expect(domains.has("properties")).toBe(true);
    expect(domains.has("installed_systems")).toBe(true);
    expect(domains.has("company_brain")).toBe(true);
  });

  it("finds jobs by job number and ranks exact matches first", async () => {
    const response = await searchCopilot("JOB-1001", undefined, getFallbackSearchRecords());
    const topResult = response.groups.flatMap((group) => group.items)[0];

    expect(topResult?.domain).toBe("jobs");
    expect(topResult?.title).toContain("JOB-1001");
  });

  it("boosts active jobs for operational relevance", async () => {
    const response = await searchCopilot("compressor diagnostics", undefined, [
      {
        id: "job-active",
        title: "JOB-9001 · Compressor diagnostics",
        subtitle: "North Hub • In Progress",
        domain: "jobs",
        sourceLabel: "Jobs",
        href: "/jobs/job-active",
        metadata: { badges: ["Service", "High"], status: "In Progress", timestamp: "2026-07-20" },
        tokens: ["compressor", "diagnostics", "job-9001"],
        recordType: "entity",
      },
      {
        id: "job-completed",
        title: "JOB-9002 · Compressor diagnostics",
        subtitle: "North Hub • Completed",
        domain: "jobs",
        sourceLabel: "Jobs",
        href: "/jobs/job-completed",
        metadata: { badges: ["Service", "High"], status: "Completed", timestamp: "2026-07-20" },
        tokens: ["compressor", "diagnostics", "job-9002"],
        recordType: "entity",
      },
    ]);
    const topResult = response.groups.flatMap((group) => group.items)[0];

    expect(topResult?.id).toBe("job-active");
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
