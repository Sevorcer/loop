import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/copilot/search/route";

describe("copilot search API route", () => {
  it("returns grouped results for a happy-path search", async () => {
    const request = new Request("http://localhost/api/copilot/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "go to dispatch" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      groups: Array<{ items: Array<{ href: string }> }>;
    };
    const hrefs = payload.groups.flatMap((group) => group.items.map((item) => item.href));

    expect(response.status).toBe(200);
    expect(payload.groups.length).toBeGreaterThan(0);
    expect(hrefs).toContain("/dispatch");
  });

  it("returns 400 for empty query", async () => {
    const request = new Request("http://localhost/api/copilot/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "   " }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
