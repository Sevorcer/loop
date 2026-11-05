// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Search } from "lucide-react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => createElement("img", { alt: alt ?? "" }),
}));

import Sidebar, { type SidebarPhoneAction } from "../Sidebar";

const roots: Root[] = [];

async function render(node: ReturnType<typeof createElement>) {
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
});

const phoneActions: SidebarPhoneAction[] = [
  {
    label: "Ask Copilot",
    icon: Search,
    keyShortcuts: "Control+K Meta+K",
    onSelect: vi.fn(),
  },
  {
    label: "Send feedback",
    icon: Search,
    onSelect: vi.fn(),
  },
];

describe("Sidebar phone actions", () => {
  it("renders Ask Copilot and Send feedback only as phone menu rows", async () => {
    const container = await render(
      createElement(Sidebar, { id: "mobile-navigation", phoneActions }),
    );
    const search = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Ask Copilot",
    );
    const feedback = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Send feedback",
    );

    expect(search).toBeDefined();
    expect(feedback).toBeDefined();
    expect(search?.getAttribute("aria-keyshortcuts")).toBe("Control+K Meta+K");
    expect(search?.parentElement?.parentElement?.classList.contains("md:hidden")).toBe(true);
  });

  it("omits the phone actions when the desktop sidebar does not ask for them", async () => {
    const container = await render(createElement(Sidebar, { id: "desktop-sidebar" }));
    const labels = Array.from(container.querySelectorAll("button")).map(
      (button) => button.textContent,
    );

    expect(labels).not.toContain("Ask Copilot");
    expect(labels).not.toContain("Send feedback");
  });
});
