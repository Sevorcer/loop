// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "../types/job";

/**
 * Edit Job button wiring guard.
 *
 * Bug report: on the job detail page the "Edit Job" button was a silent
 * no-op — a click did not navigate — while the sibling "Back to Jobs"
 * button (same Button primitive, same router.push pattern) worked.
 *
 * This test locks the contract for both header buttons as the owner role:
 *   - the control renders and is enabled (not disabled, interactive),
 *   - clicking it calls router.push with the correct route.
 *
 * The push mock is shared (vi.hoisted) so the handler the component wires
 * at render time is the exact function we assert against. If a future
 * change drops the handler, disables the button, or hides it behind the
 * PermissionGuard for the owner role, this test fails.
 */

const authState = vi.hoisted(() => ({ role: "owner" as string }));
const push = vi.hoisted(() => vi.fn());
const requestJson = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: authState.role, setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  requestJson: (...args: unknown[]) => requestJson(...args),
}));

vi.mock("@/features/contractors/state/ContractorsProvider", () => ({
  useContractors: () => ({ contractors: [] }),
}));

vi.mock("@/features/installed-systems/state/InstalledSystemsProvider", () => ({
  useInstalledSystems: () => ({
    getInstalledSystemsForJob: () => [],
    getTechnicalProfileById: () => null,
  }),
}));

// Child panels that reach for their own providers / network are stubbed; the
// Edit Job button lives in the screen header, independent of them.
vi.mock(
  "@/features/installed-systems/components/JobInstalledSystemsPanel",
  async () => {
    const { createElement: ce } = await import("react");
    return { JobInstalledSystemsPanel: () => ce("div", null, "systems stub") };
  },
);
vi.mock("../components/AssignContractorPanel", async () => {
  const { createElement: ce } = await import("react");
  return { AssignContractorPanel: () => ce("div", null, "contractor stub") };
});
vi.mock("../components/CreateCallbackPanel", async () => {
  const { createElement: ce } = await import("react");
  return { CreateCallbackPanel: () => ce("div", null, "callback stub") };
});
vi.mock("../components/JobDayByDay", async () => {
  const { createElement: ce } = await import("react");
  return { JobDayByDay: () => ce("div", null, "day by day stub") };
});
vi.mock("../components/JobSignatureCard", async () => {
  const { createElement: ce } = await import("react");
  return { JobSignatureCard: () => ce("div", null, "signature stub") };
});

import { JobDetailScreen } from "../components/JobDetailScreen";

const JOB: Job = {
  id: "job-1",
  jobNumber: "JOB-1001",
  title: "Furnace replacement",
  type: "Install",
  status: "In Progress",
  priority: "Medium",
  customerId: "customer-1",
  customerName: "Acme Properties",
  propertyId: "property-1",
  propertyName: "Acme HQ",
  assignedTo: "Sam Tech",
  scheduledFor: "2026-11-02",
  scheduledStartAt: "2026-11-02T15:00:00.000Z",
  scheduledEndAt: "2026-11-02T19:00:00.000Z",
  summary: "Replace the rooftop furnace and reconnect ductwork.",
  location: "100 Main St, Springfield",
  notes: "",
  closeoutMode: "full",
  contractorIds: [],
  assignees: [{ id: "user-1", name: "Sam Tech" }],
};

const roots: Root[] = [];

async function render(node: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return container;
}

async function renderScreen() {
  return render(
    createElement(JobDetailScreen, {
      job: JOB,
      activity: [],
      notes: [],
      onUpdateStatus: vi.fn(async () => {}),
      onAddNote: vi.fn(async () => {}),
      onUpdateQaChecklist: vi.fn(async () => {}),
    }),
  );
}

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
}

beforeEach(() => {
  authState.role = "owner";
  push.mockReset();
  requestJson.mockReset();
  requestJson.mockImplementation(async (url: string) => {
    if (typeof url === "string") {
      if (url.endsWith("/tasks")) return { tasks: [] };
      if (url.endsWith("/files")) return { files: [] };
      if (url.includes("completion-checklist")) return { checklist: null };
      if (url.includes("/signatures")) return { signatures: [] };
    }
    return {};
  });
});

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop()!;
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = "";
});

describe("JobDetailScreen — Edit Job button wiring", () => {
  it("renders Edit Job as an enabled, interactive control for the owner", async () => {
    const container = await renderScreen();
    const editButton = findButton(container, "Edit Job");

    expect(editButton, "Edit Job button should render for the owner role").toBeTruthy();
    expect(editButton!.disabled).toBe(false);
    expect(editButton!.getAttribute("aria-disabled")).not.toBe("true");
    // Native buttons default to type=submit; the control must be a plain button
    // so a click runs its handler rather than any implicit submit behaviour.
    expect(editButton!.getAttribute("type")).toBe("button");
  });

  it("navigates to the job edit route when Edit Job is clicked", async () => {
    const container = await renderScreen();
    const editButton = findButton(container, "Edit Job");

    await act(async () => {
      editButton!.click();
    });

    expect(push).toHaveBeenCalledWith("/jobs/job-1/edit");
  });

  it("still navigates back to the jobs list from the sibling Back button", async () => {
    const container = await renderScreen();
    const backButton = findButton(container, "Back to Jobs");

    await act(async () => {
      backButton!.click();
    });

    expect(push).toHaveBeenCalledWith("/jobs");
  });

  it("hides Edit Job from the tech role", async () => {
    authState.role = "tech";
    const container = await renderScreen();

    expect(findButton(container, "Edit Job")).toBeFalsy();
  });
});
