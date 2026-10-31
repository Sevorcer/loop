// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hidesFloatingActions } from "../floatingActions";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return {
    default: ({
      children,
      href,
    }: {
      children?: ReactNode;
      href?: string;
    }) => create("a", { href: typeof href === "string" ? href : "#" }, children),
  };
});

vi.mock("@/features/command-bar", () => ({
  UniversalCommandBar: () => null,
}));

vi.mock("@/features/feedback", () => ({
  FeedbackButton: () =>
    createElement("button", { type: "button", "aria-label": "Report feedback" }, "Feedback"),
}));

vi.mock("@/features/settings/hooks/useAppearancePreferences", () => ({
  useAppearancePreferences: () => ({
    preferences: { sidebarNavOverride: null },
  }),
}));

vi.mock("../Sidebar", () => ({
  default: () => null,
}));

vi.mock("../Header", () => ({
  default: () => null,
}));

import AppShell from "../AppShell";

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
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots.length = 0;
  document.body.innerHTML = "";
  pathname.current = "/dashboard";
});

describe("hidesFloatingActions", () => {
  it("hides the corner buttons on the new job form and a job edit form", () => {
    expect(hidesFloatingActions("/jobs/new")).toBe(true);
    expect(hidesFloatingActions("/jobs/new?customerId=abc")).toBe(true);
    expect(hidesFloatingActions("/jobs/job-42/edit")).toBe(true);
    expect(hidesFloatingActions("/jobs/job-42/edit/")).toBe(true);
  });

  it("keeps the corner buttons on every other jobs route", () => {
    expect(hidesFloatingActions("/jobs")).toBe(false);
    expect(hidesFloatingActions("/jobs/job-42")).toBe(false);
    expect(hidesFloatingActions("/dashboard")).toBe(false);
    expect(hidesFloatingActions("/customers/new")).toBe(false);
    expect(hidesFloatingActions("/jobs/edit")).toBe(false);
  });
});

describe("AppShell floating actions", () => {
  it("renders the corner buttons on a normal page", async () => {
    pathname.current = "/dashboard";
    const container = await render(createElement(AppShell, null, "page"));

    expect(container.querySelector(".floating-actions-stack")).not.toBeNull();
    expect(container.querySelector("[aria-label='Report feedback']")).not.toBeNull();
    expect(container.querySelector("[aria-label='Open command bar']")).not.toBeNull();
    expect(container.querySelector(".safe-area-content--form")).toBeNull();
  });

  it("hides the corner buttons on the new job form and keeps bottom padding", async () => {
    pathname.current = "/jobs/new";
    const container = await render(createElement(AppShell, null, "form"));
    const content = container.querySelector(".safe-area-content");

    expect(container.querySelector(".floating-actions-stack")).toBeNull();
    expect(container.querySelector("[aria-label='Report feedback']")).toBeNull();
    expect(container.querySelector("[aria-label='Open command bar']")).toBeNull();
    expect(content?.classList.contains("safe-area-content--form")).toBe(true);
  });

  it("hides the corner buttons on the job edit form", async () => {
    pathname.current = "/jobs/9f3c/edit";
    const container = await render(createElement(AppShell, null, "form"));

    expect(container.querySelector(".floating-actions-stack")).toBeNull();
    expect(container.querySelector(".safe-area-content--form")).not.toBeNull();
  });
});
