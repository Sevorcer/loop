// @vitest-environment happy-dom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const { createElement: create } = await import("react");
  return {
    default: ({
      children,
      href,
      className,
    }: {
      children?: ReactNode;
      href?: string;
      className?: string;
    }) => create("a", { href: typeof href === "string" ? href : "#", className }, children),
  };
});

import { DataTable } from "../DataTable";

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

const columns = [
  {
    accessorKey: "jobNumber",
    header: "Job",
    meta: { mobilePrimary: true, mobileLabel: "Job" },
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    meta: { mobileLabel: "Customer" },
  },
];

const jobs = [
  { id: "job-1", jobNumber: "JOB-1004", customerName: "Shady Baby" },
];

describe("DataTable phone cards", () => {
  it("renders the whole card as a link when a row href is provided", async () => {
    const container = await render(
      createElement(DataTable<(typeof jobs)[number]>, {
        columns,
        data: jobs,
        getRowHref: (job) => `/jobs/${job.id}`,
      }),
    );

    const link = container.querySelector('a[href="/jobs/job-1"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("JOB-1004");
    expect(link?.textContent).toContain("Shady Baby");
    expect(link?.getAttribute("role")).not.toBe("button");
  });

  it("keeps a keyboard-focusable button card when only onRowClick is set", async () => {
    const onRowClick = vi.fn();
    const container = await render(
      createElement(DataTable<(typeof jobs)[number]>, {
        columns,
        data: jobs,
        onRowClick,
      }),
    );

    expect(container.querySelector("a")).toBeNull();
    const card = container.querySelector('[role="button"]');
    expect(card?.getAttribute("tabindex")).toBe("0");
    card?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onRowClick).toHaveBeenCalledWith(jobs[0]);
  });
});
