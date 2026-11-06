// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerContact } from "@/features/customers/types/customerContact";

import { JobInfoContact } from "../JobInfoContact";

const roots: Root[] = [];
const fetchMock = vi.fn();

const CONTACT: CustomerContact = {
  id: "contact-1",
  customerId: "customer-1",
  name: "Jordan Site",
  role: "pm",
  phone: "(425) 555-0101",
  email: "jordan@example.com",
  isPrimary: true,
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

async function renderContact() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(createElement(JobInfoContact, { customerId: "customer-1" }));
  });
  await act(async () => {});
  return container;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop()!;
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("JobInfoContact", () => {
  it("shows the contact name with tap-to-call and tap-to-email links", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contacts: [CONTACT] }));

    const container = await renderContact();

    expect(fetchMock).toHaveBeenCalledWith("/api/customers/customer-1/contacts", {
      credentials: "include",
    });
    expect(container.textContent).toContain("Jordan Site");
    expect(container.textContent).toContain("PM · Primary");
    const phoneLink = container.querySelector('a[href="tel:(425) 555-0101"]');
    const emailLink = container.querySelector('a[href="mailto:jordan@example.com"]');
    expect(phoneLink?.textContent).toContain("(425) 555-0101");
    expect(emailLink?.textContent).toContain("jordan@example.com");
  });

  it("renders nothing when the customer has no contacts", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contacts: [] }));

    const container = await renderContact();

    expect(container.querySelector("[data-testid='job-info-contact']")).toBeNull();
  });

  it("renders nothing when the contacts read fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "Nope" }, false, 403));

    const container = await renderContact();

    expect(container.querySelector("[data-testid='job-info-contact']")).toBeNull();
  });
});
