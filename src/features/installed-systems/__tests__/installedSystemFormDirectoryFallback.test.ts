// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { requestJsonMock } = vi.hoisted(() => ({ requestJsonMock: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ requestJson: requestJsonMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: "tech" }),
}));
vi.mock("@/features/installed-systems/state/InstalledSystemsProvider", () => ({
  useInstalledSystems: () => ({ refreshSystems: vi.fn(async () => {}) }),
}));

import { InstalledSystemForm } from "../components/InstalledSystemForm";

const roots: Root[] = [];

async function renderForm() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(createElement(InstalledSystemForm, { embedded: true }));
  });
  // Let the directory-load effects settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop()!;
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("InstalledSystemForm — directory fallback", () => {
  it("falls back to name fields when the customer/property directories fail (e.g. tech 403)", async () => {
    requestJsonMock.mockRejectedValue(new Error("Forbidden"));

    const container = await renderForm();

    expect(container.querySelector('[aria-label="Customer name"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Property name"]')).toBeTruthy();
    expect(container.textContent).toContain("Customer list unavailable");
    expect(container.textContent).toContain("Property list unavailable");
    expect(container.querySelector('[aria-label="Search customers"]')).toBeNull();
  });

  it("keeps the pickers when the directories load", async () => {
    requestJsonMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/customers")) {
        return { customers: [{ id: "c1", name: "Acme Corp" }] };
      }
      if (url.startsWith("/api/properties")) {
        return { properties: [{ id: "p1", name: "Acme HQ" }] };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const container = await renderForm();

    expect(container.querySelector('[aria-label="Search customers"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Customer name"]')).toBeNull();
    expect(container.textContent).not.toContain("Customer list unavailable");
    expect(container.textContent).toContain("Acme Corp");
  });
});
