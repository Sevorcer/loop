// @vitest-environment happy-dom
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/jobs",
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

vi.mock("@/features/auth", () => ({
  useSession: () => ({ user: { email: "tech@example.com" }, loading: false }),
}));

import Header from "../Header";

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
});

describe("Header mobile search (item 6)", () => {
  it("renders a Search / Ask Copilot control that opens the command bar", async () => {
    const onOpenCommandBar = vi.fn();
    const container = await render(
      createElement(Header, {
        isMobileNavOpen: false,
        onMenuToggle: () => {},
        onOpenCommandBar,
      }),
    );

    const button = container.querySelector("[aria-label='Search / Ask Copilot']");
    expect(button).not.toBeNull();

    await act(async () => {
      (button as HTMLButtonElement).click();
    });
    expect(onOpenCommandBar).toHaveBeenCalledTimes(1);
  });
});
