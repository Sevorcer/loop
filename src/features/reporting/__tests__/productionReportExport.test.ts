// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductionReportPage } from "../utils/productionReport";

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: "owner", setDevRole: () => {} }),
}));

import { ProductionReportSection } from "../components/ProductionReportSection";

const roots: Root[] = [];

function reportFor(from: string, to: string): ProductionReportPage {
  return {
    from,
    to,
    hoursLabel: "Scheduled hours",
    canSeeRevenue: true,
    totals: {
      jobs: 1,
      scheduledHours: 6,
      jobsWithHours: 1,
      revenueCents: 250000,
      jobsWithRevenue: 1,
      averageTicketCents: 250000,
    },
    teams: [
      {
        key: "alex",
        label: "Alex Nguyen",
        jobs: 1,
        scheduledHours: 6,
        revenueCents: 250000,
        averageTicketCents: 250000,
      },
    ],
    people: [
      {
        key: "alex",
        label: "Alex Nguyen",
        jobs: 1,
        scheduledHours: 6,
        revenueCents: 250000,
        averageTicketCents: 250000,
        equalShareCents: 250000,
        fullJobRevenueCents: 250000,
      },
    ],
    jobs: [
      {
        id: "job-31",
        jobNumber: "JOB-31",
        title: "Furnace install",
        customerName: "Northwind",
        team: "Alex Nguyen",
        completedOn: "2026-10-31",
        scheduledHours: 6,
        revenueCents: 250000,
      },
    ],
    jobsTotal: 1,
    page: 1,
    pageSize: 100,
    hasMore: false,
  };
}

// The server builds the full CSV; the client only downloads it.
function csvFor(): string {
  return [
    "Teams,Jobs,Revenue,Average ticket,Scheduled hours",
    "Alex Nguyen,1,$2500.00,$2500.00,6 h",
    "",
    "Job,Title,Customer,Team,Completed,Revenue,Scheduled hours",
    "JOB-31,Furnace install,Northwind,Alex Nguyen,2026-10-31,$2500.00,6 h",
    "",
  ].join("\n");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function csvResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  return container;
}

function downloadButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.textContent === "Download CSV"
    || item.textContent === "Loading…"
    || item.textContent === "Downloading…",
  );
  if (!button) throw new Error("Download button is missing.");
  return button as HTMLButtonElement;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => {
      root?.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("production CSV download", () => {
  it("stays disabled until the report on screen is ready, then downloads the full CSV from the server", async () => {
    const requests: string[] = [];
    let pending: { url: string; resolve: (response: Response) => void } | null = null;
    vi.stubGlobal(
      "fetch",
      (input: RequestInfo | URL) => {
        const url = String(input);
        requests.push(url);
        return new Promise<Response>((resolve) => {
          pending = { url, resolve };
        });
      },
    );
    const files: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      void (blob as Blob).text().then((text) => {
        files.push(text);
      });
      return "blob:production";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const container = await render(createElement(ProductionReportSection));
    const waiting = downloadButton(container);
    expect(waiting.disabled).toBe(true);
    expect(waiting.textContent).toBe("Loading…");
    expect(waiting.getAttribute("aria-busy")).toBe("true");

    // First request loads page 1 of the report — never the CSV.
    const first = pending as { url: string; resolve: (response: Response) => void } | null;
    if (!first) throw new Error("The report was not requested.");
    expect(first.url).not.toContain("format=csv");
    expect(first.url).toContain("page=1");
    const firstUrl = new URL(first.url, "http://localhost");
    await act(async () => {
      first.resolve(jsonResponse({
        report: reportFor(firstUrl.searchParams.get("from") ?? "", firstUrl.searchParams.get("to") ?? ""),
      }));
    });

    const ready = downloadButton(container);
    expect(ready.disabled).toBe(false);
    expect(ready.textContent).toBe("Download CSV");

    // Clicking download asks the server for the full CSV export.
    await act(async () => {
      ready.click();
    });
    const csvRequest = pending as { url: string; resolve: (response: Response) => void };
    expect(csvRequest.url).toContain("format=csv");
    await act(async () => {
      csvRequest.resolve(csvResponse(csvFor()));
    });
    await vi.waitFor(() => {
      expect(files[0]).toContain("JOB-31");
    });
    expect(files[0]).toContain("Furnace install");

    // Switching the range reloads page 1 (again, not the CSV).
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Last month")?.click();
    });
    const reloading = downloadButton(container);
    expect(reloading.disabled).toBe(true);
    expect(reloading.textContent).toBe("Loading…");

    const second = pending as { url: string; resolve: (response: Response) => void };
    expect(second.url).not.toContain("format=csv");
    const secondUrl = new URL(second.url, "http://localhost");
    await act(async () => {
      second.resolve(jsonResponse({
        report: reportFor(secondUrl.searchParams.get("from") ?? "", secondUrl.searchParams.get("to") ?? ""),
      }));
    });
    expect(downloadButton(container).disabled).toBe(false);

    // Exactly one CSV request was ever made, from the download click.
    expect(requests.filter((url) => url.includes("format=csv"))).toHaveLength(1);
  });
});
