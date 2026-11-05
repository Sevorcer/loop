// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ role: "tech" as string | null }));
const requestJson = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: authState.role, setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  requestJson: (...args: unknown[]) => requestJson(...args),
}));

vi.mock("../components/JobPhotoGrid", () => ({
  JobPhotoGrid: () => createElement("div", { "data-testid": "photo-grid" }),
}));

import { JobFilesPanel } from "../components/JobFilesPanel";

const roots: Root[] = [];

async function render(node: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  return container;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

beforeEach(() => {
  authState.role = "tech";
  requestJson.mockResolvedValue({ files: [] });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: "INTERNAL_SERVER_ERROR",
        message: "Storage upload failed after 3 attempts: Bucket not found",
      }),
    })),
  );
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

describe("JobFilesPanel pending uploads", () => {
  it("keeps a failed upload visible with the real server reason and a Retry control", async () => {
    const container = await render(createElement(JobFilesPanel, { jobId: "job-1" }));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File([new Uint8Array([1, 2, 3, 4])], "IMG_8373.jpeg", {
      type: "image/jpeg",
    });
    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // Let the async upload settle.
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Wait a tick for state updates from the failed fetch.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const pending = container.querySelector('[data-testid="pending-uploads"]');
    expect(pending).toBeTruthy();
    expect(pending?.textContent).toContain("IMG_8373.jpeg");
    expect(pending?.textContent).toContain("Storage upload failed after 3 attempts");
    expect(
      [...container.querySelectorAll("button")].some((button) =>
        button.getAttribute("aria-label")?.includes("Retry IMG_8373.jpeg"),
      ),
    ).toBe(true);
    expect(
      [...container.querySelectorAll("button")].some((button) =>
        button.getAttribute("aria-label")?.includes("Discard IMG_8373.jpeg"),
      ),
    ).toBe(true);
  });

  it("removes a pending row only when the user discards it", async () => {
    const container = await render(createElement(JobFilesPanel, { jobId: "job-1" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([9])], "fail.jpg", { type: "image/jpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.querySelector('[data-testid="pending-uploads"]')).toBeTruthy();

    const discard = [...container.querySelectorAll("button")].find((button) =>
      button.getAttribute("aria-label")?.includes("Discard fail.jpg"),
    );
    expect(discard).toBeTruthy();
    await act(async () => {
      discard?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="pending-uploads"]')).toBeNull();
  });
});
