// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CORNER_ACTIONS_VISIBILITY_CLASS,
  PHONE_NAV_ACTIONS_VISIBILITY_CLASS,
  hidesFloatingActions,
} from "../floatingActions";

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
  UniversalCommandBar: ({ open }: { open: boolean }) =>
    createElement(
      "div",
      { "data-command-bar": "mounted", "data-open": open ? "true" : "false" },
      open
        ? createElement("div", { role: "dialog", "aria-label": "Search" }, "search")
        : null,
    ),
}));

vi.mock("@/features/feedback", () => ({
  FeedbackButton: ({ onOpen }: { onOpen?: () => void }) =>
    createElement(
      "button",
      { type: "button", "aria-label": "Report feedback", onClick: onOpen },
      "Feedback",
    ),
  FeedbackModal: () =>
    createElement("div", { role: "dialog", "aria-label": "Report Feedback" }, "feedback form"),
}));

vi.mock("@/features/settings/hooks/useAppearancePreferences", () => ({
  useAppearancePreferences: () => ({
    preferences: { sidebarNavOverride: null },
  }),
}));

vi.mock("../Sidebar", () => ({
  default: ({
    id,
    phoneActions,
  }: {
    id?: string;
    phoneActions?: ReadonlyArray<{ label: string; onSelect: () => void; keyShortcuts?: string }>;
  }) =>
    createElement(
      "div",
      { id },
      (phoneActions ?? []).map((action) =>
        createElement(
          "button",
          {
            type: "button",
            key: action.label,
            "aria-keyshortcuts": action.keyShortcuts,
            onClick: action.onSelect,
          },
          action.label,
        ),
      ),
    ),
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

describe("phone corner-action breakpoint", () => {
  it("hides the corner buttons below md and shows the menu actions there", () => {
    expect(CORNER_ACTIONS_VISIBILITY_CLASS).toBe("hidden md:flex");
    expect(PHONE_NAV_ACTIONS_VISIBILITY_CLASS).toBe("md:hidden");
  });

  it("drops the phone padding that only cleared the corner buttons", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).not.toContain("padding-bottom: calc(12rem + env(safe-area-inset-bottom, 0px))");
    expect(css).toContain(".safe-area-content.safe-area-content--form");
    expect(css).toContain("padding-bottom: calc(6rem + env(safe-area-inset-bottom, 0px))");
  });
});

describe("AppShell floating actions", () => {
  it("renders the corner buttons on a normal page and keeps them for tablet and desktop", async () => {
    pathname.current = "/dashboard";
    const container = await render(createElement(AppShell, null, "page"));
    const stack = container.querySelector(".floating-actions-stack");

    expect(stack).not.toBeNull();
    expect(stack?.classList.contains("hidden")).toBe(true);
    expect(stack?.classList.contains("md:flex")).toBe(true);
    expect(container.querySelector("[aria-label='Report feedback']")).not.toBeNull();
    expect(container.querySelector("[aria-label='Open command bar']")).not.toBeNull();
    expect(container.querySelector(".safe-area-content--form")).toBeNull();
    expect(container.querySelector("[data-command-bar='mounted']")).not.toBeNull();
  });

  it("puts Search and Send feedback on the phone menu only", async () => {
    pathname.current = "/dashboard";
    const container = await render(createElement(AppShell, null, "page"));
    const mobileNav = container.querySelector("#mobile-navigation");
    const desktopNav = container.querySelector("#desktop-navigation");

    expect(mobileNav?.textContent).toContain("Search");
    expect(mobileNav?.textContent).toContain("Send feedback");
    expect(desktopNav?.textContent ?? "").not.toContain("Send feedback");
    expect(
      mobileNav?.querySelector("[aria-keyshortcuts='Control+K Meta+K']"),
    ).not.toBeNull();
  });

  it("opens search and the feedback form from the phone menu", async () => {
    pathname.current = "/jobs";
    const container = await render(createElement(AppShell, null, "jobs"));
    const mobileNav = container.querySelector("#mobile-navigation");
    const search = Array.from(mobileNav?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Search",
    );
    const feedback = Array.from(mobileNav?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === "Send feedback",
    );

    await act(async () => {
      search?.click();
    });

    expect(container.querySelector("[data-open='true']")).not.toBeNull();
    expect(container.querySelector("[aria-label='Search']")).not.toBeNull();

    await act(async () => {
      feedback?.click();
    });

    expect(container.querySelector("[aria-label='Report Feedback']")).not.toBeNull();
  });

  it("hides the corner buttons on the new job form and keeps bottom padding", async () => {
    pathname.current = "/jobs/new";
    const container = await render(createElement(AppShell, null, "form"));
    const content = container.querySelector(".safe-area-content");

    expect(container.querySelector(".floating-actions-stack")).toBeNull();
    expect(container.querySelector("[aria-label='Report feedback']")).toBeNull();
    expect(container.querySelector("[aria-label='Open command bar']")).toBeNull();
    expect(content?.classList.contains("safe-area-content--form")).toBe(true);
    expect(container.querySelector("#mobile-navigation")?.textContent).toContain("Search");
    expect(container.querySelector("[data-command-bar='mounted']")).not.toBeNull();
  });

  it("hides the corner buttons on the job edit form", async () => {
    pathname.current = "/jobs/9f3c/edit";
    const container = await render(createElement(AppShell, null, "form"));

    expect(container.querySelector(".floating-actions-stack")).toBeNull();
    expect(container.querySelector(".safe-area-content--form")).not.toBeNull();
  });
});
