// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "../types/job";
import type { JobNote } from "../types/jobNote";
import type { JobCloseoutMode } from "../types/job";
import type { JobCompletionChecklistStatus } from "../utils/jobCompletionChecklist";
import {
  buildCloseoutSteps,
  closeoutSectionKeyForStep,
} from "../utils/jobCloseout";

const authState = vi.hoisted(() => ({ role: "owner" }));
const requestJson = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/auth", () => ({
  useCurrentRole: () => ({ role: authState.role, setDevRole: () => {} }),
}));

vi.mock("@/lib/api/client", () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
    }
  },
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

// Panels that pull their own providers or navigation flows are stubbed;
// the systems stub reports its count through the real callback prop so the
// tab badge wiring is exercised end to end.
vi.mock(
  "@/features/installed-systems/components/JobInstalledSystemsPanel",
  async () => {
    const { createElement: ce, useEffect } = await import("react");
    return {
      JobInstalledSystemsPanel: (props: {
        onCountChange?: (count: number) => void;
      }) => {
        const onCountChange = props.onCountChange;
        useEffect(() => {
          onCountChange?.(2);
        }, [onCountChange]);
        return ce("div", null, "Installed systems stub");
      },
    };
  },
);

vi.mock("../components/AssignContractorPanel", async () => {
  const { createElement: ce } = await import("react");
  return { AssignContractorPanel: () => ce("div", null, "Contractor stub") };
});

vi.mock("../components/CreateCallbackPanel", async () => {
  const { createElement: ce } = await import("react");
  return { CreateCallbackPanel: () => ce("div", null, "Callback stub") };
});

vi.mock("../components/JobDayByDay", async () => {
  const { createElement: ce } = await import("react");
  return { JobDayByDay: () => ce("div", null, "Day by day stub") };
});

vi.mock("../components/JobSignatureCard", async () => {
  const { createElement: ce } = await import("react");
  return { JobSignatureCard: () => ce("div", null, "Signature stub") };
});

import { JobCloseoutPanel } from "../components/JobCloseoutPanel";
import { JobDetailScreen } from "../components/JobDetailScreen";

type ChecklistPayload = JobCompletionChecklistStatus & {
  closeoutMode: JobCloseoutMode;
};

const ALL_MISSING: ChecklistPayload = {
  photosUploaded: false,
  installedSystemsEntered: false,
  jobNotesCompleted: false,
  requiredQaItemsComplete: false,
  customerSignaturePlaceholder: "optional",
  canComplete: false,
  closeoutMode: "full",
};

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

const NOTES: JobNote[] = [
  {
    id: "note-1",
    jobId: "job-1",
    body: "Old unit is out, new unit is on the curb.",
    authorId: "user-1",
    authorName: "Sam Tech",
    authorRole: "tech",
    createdAt: "2026-11-02T16:00:00.000Z",
  },
];

const TASKS = [
  { id: "task-1", label: "Field task done", isDone: true, section: "field" },
  { id: "task-2", label: "Field task open", isDone: false, section: "field" },
  { id: "task-3", label: "Office task open", isDone: false, section: "office" },
].map((task, index) => ({
  ...task,
  jobId: "job-1",
  section: task.section as "field" | "office",
  sortOrder: index,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  completedAt: null,
  completedBy: null,
}));

const FILES = [
  { id: "file-1", fileName: "before.jpg", mimeType: "image/jpeg", uploaderRole: "tech" },
  { id: "file-2", fileName: "after.jpg", mimeType: "image/jpeg", uploaderRole: "tech" },
  { id: "file-3", fileName: "permit.pdf", mimeType: "application/pdf", uploaderRole: "office" },
].map((file) => ({
  ...file,
  sizeBytes: 2048,
  uploadedBy: "user-1",
  createdAt: "2026-11-01T00:00:00.000Z",
  previewUrl: null,
}));

const roots: Root[] = [];

async function render(node: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(node);
  });
  // Flush the panels' queued data loads (tasks / files / signature stubs).
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
      notes: NOTES,
      onUpdateStatus: vi.fn(async () => {}),
      onAddNote: vi.fn(async () => {}),
      onUpdateQaChecklist: vi.fn(async () => {}),
    }),
  );
}

function tabs(container: HTMLElement, idPrefix: string) {
  return [...container.querySelectorAll<HTMLElement>(`[id^="${idPrefix}"]`)];
}

function panel(container: HTMLElement, tab: string) {
  return container.querySelector<HTMLElement>(`#job-detail-panel-${tab}`);
}

function findButton(container: HTMLElement, text: string, within?: HTMLElement) {
  return [...(within ?? container).querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

async function click(button: HTMLButtonElement | undefined) {
  expect(button, "expected a button to click").toBeTruthy();
  await act(async () => {
    button!.click();
  });
  await act(async () => {});
}

beforeEach(() => {
  authState.role = "owner";
  requestJson.mockReset();
  requestJson.mockImplementation(async (url: string) => {
    if (url.includes("completion-checklist")) return { checklist: ALL_MISSING };
    if (url.endsWith("/tasks")) return { tasks: TASKS };
    if (url.endsWith("/files")) return { files: FILES };
    if (url.includes("/signatures")) return { signatures: [] };
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

describe("closeoutSectionKeyForStep", () => {
  it("maps each jumpable step to its tab section and the note step to null", () => {
    const steps = buildCloseoutSteps(ALL_MISSING);

    expect(steps.map((step) => closeoutSectionKeyForStep(step))).toEqual([
      null,
      "files",
      "tasks",
      "systems",
    ]);
  });
});

describe("JobCloseoutPanel with onShowSection", () => {
  it("routes the step jumps through onShowSection instead of scrolling", async () => {
    const onShowSection = vi.fn();
    const container = await render(
      createElement(JobCloseoutPanel, {
        jobId: "job-1",
        status: "In Progress",
        onAddNote: vi.fn(async () => {}),
        onUpdateStatus: vi.fn(async () => {}),
        onShowSection,
      }),
    );

    await click(findButton(container, "Start closeout"));

    await click(findButton(container, "Go to Photos & Files"));
    expect(onShowSection).toHaveBeenCalledWith("files");

    await click(findButton(container, "Go to QA checklist"));
    expect(onShowSection).toHaveBeenCalledWith("tasks");

    await click(findButton(container, "Go to Installed systems"));
    expect(onShowSection).toHaveBeenCalledWith("systems");
    expect(onShowSection).toHaveBeenCalledTimes(3);
  });
});

describe("JobDetailScreen tabs", () => {
  it("renders all five tabs in both navs, with Overview active by default", async () => {
    const container = await renderScreen();

    const desktopTabs = tabs(container, "job-detail-tab-desktop-");
    const mobileTabs = tabs(container, "job-detail-tab-mobile-");
    expect(desktopTabs).toHaveLength(5);
    expect(mobileTabs).toHaveLength(5);
    expect(desktopTabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("Overview"),
      expect.stringContaining("Tasks & QA"),
      expect.stringContaining("Photos & Files"),
      expect.stringContaining("Systems"),
      expect.stringContaining("Activity"),
    ]);

    expect(panel(container, "overview")?.classList.contains("hidden")).toBe(false);
    for (const tab of ["tasks", "photos", "systems", "activity"]) {
      expect(panel(container, tab)?.classList.contains("hidden")).toBe(true);
      expect(panel(container, tab)?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(
      container.querySelector("#job-detail-tab-desktop-overview")?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("switching tabs shows that panel, hides the others, and syncs both navs", async () => {
    const container = await renderScreen();

    await click(
      container.querySelector<HTMLButtonElement>("#job-detail-tab-mobile-photos") ?? undefined,
    );

    expect(panel(container, "photos")?.classList.contains("hidden")).toBe(false);
    expect(panel(container, "overview")?.classList.contains("hidden")).toBe(true);
    expect(
      container.querySelector("#job-detail-tab-desktop-photos")?.getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      container.querySelector("#job-detail-tab-mobile-photos")?.getAttribute("aria-selected"),
    ).toBe("true");
    // Panels stay mounted while hidden — the files panel content is still in the tree.
    expect(panel(container, "overview")?.textContent).toContain("Work Summary");

    await click(
      container.querySelector<HTMLButtonElement>("#job-detail-tab-desktop-tasks") ?? undefined,
    );

    expect(panel(container, "tasks")?.classList.contains("hidden")).toBe(false);
    expect(panel(container, "photos")?.classList.contains("hidden")).toBe(true);
  });

  it("shows count badges reported by the panels", async () => {
    const container = await renderScreen();

    const desktopTasks = container.querySelector("#job-detail-tab-desktop-tasks");
    const desktopPhotos = container.querySelector("#job-detail-tab-desktop-photos");
    const desktopSystems = container.querySelector("#job-detail-tab-desktop-systems");
    const mobileTasks = container.querySelector("#job-detail-tab-mobile-tasks");

    // 1 of 3 tasks done across the field + office lists.
    expect(desktopTasks?.textContent).toContain("1/3");
    // 3 files loaded by the files panel.
    expect(desktopPhotos?.textContent).toContain("3");
    // 2 systems reported by the systems panel stub.
    expect(desktopSystems?.textContent).toContain("2");
    // Mobile flags what's left on Tasks.
    expect(mobileTasks?.textContent).toContain("2 left");
  });

  it("keeps the notes history under Activity, not Overview", async () => {
    const container = await renderScreen();

    expect(panel(container, "activity")?.textContent).toContain(
      "Old unit is out, new unit is on the curb.",
    );
    expect(panel(container, "overview")?.textContent).not.toContain(
      "Old unit is out, new unit is on the curb.",
    );
    expect(panel(container, "overview")?.textContent).toContain("Work Summary");
  });

  it("a closeout step jump switches to the owning tab", async () => {
    const container = await renderScreen();
    const overview = panel(container, "overview")!;

    await click(findButton(container, "Start closeout", overview));
    await click(findButton(container, "Go to Photos & Files", overview));

    expect(panel(container, "photos")?.classList.contains("hidden")).toBe(false);
    expect(panel(container, "overview")?.classList.contains("hidden")).toBe(true);
    expect(
      container.querySelector("#job-detail-tab-desktop-photos")?.getAttribute("aria-selected"),
    ).toBe("true");

    await click(findButton(container, "Go to QA checklist", overview));
    expect(panel(container, "tasks")?.classList.contains("hidden")).toBe(false);
    // The QA checklist card lives in the Tasks & QA tab now.
    expect(panel(container, "tasks")?.querySelector("#job-closeout-qa")).toBeTruthy();

    await click(findButton(container, "Go to Installed systems", overview));
    expect(panel(container, "systems")?.classList.contains("hidden")).toBe(false);
  });
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("JobTasksCard add item (B3 — mouse users can add, not only Enter)", () => {
  it("submitting the checklist field posts a new item for mouse users", async () => {
    // POST returns the created task so the optimistic insert has a valid row.
    requestJson.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url.includes("completion-checklist")) return { checklist: ALL_MISSING };
      if (url.endsWith("/files")) return { files: FILES };
      if (url.includes("/signatures")) return { signatures: [] };
      if (url.endsWith("/tasks")) {
        if (options?.method === "POST") {
          return {
            task: {
              id: "task-new",
              jobId: "job-1",
              label: "Pull the permit",
              isDone: false,
              section: "field",
              sortOrder: 99,
              createdAt: "2026-11-03T00:00:00.000Z",
              updatedAt: "2026-11-03T00:00:00.000Z",
              completedAt: null,
              completedBy: null,
            },
          };
        }
        return { tasks: TASKS };
      }
      return {};
    });

    const container = await renderScreen();
    await click(
      container.querySelector<HTMLButtonElement>("#job-detail-tab-desktop-tasks") ?? undefined,
    );

    const tasksPanel = panel(container, "tasks")!;
    const input = tasksPanel.querySelector<HTMLInputElement>('input[type="text"]');
    expect(input, "expected the checklist field input").toBeTruthy();

    await act(async () => {
      setInputValue(input!, "Pull the permit");
    });

    // The Add button is the submit control inside the field's own form — click
    // it the way a mouse user would, not via the Enter key on the input.
    const form = input!.closest("form");
    const addButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? undefined;
    expect(addButton?.textContent).toContain("Add");
    expect(addButton?.disabled).toBe(false);
    await click(addButton);

    const postCall = requestJson.mock.calls.find(
      ([url, options]) =>
        typeof url === "string" &&
        url.endsWith("/tasks") &&
        (options as { method?: string } | undefined)?.method === "POST",
    );
    expect(postCall, "expected a POST to /tasks when the Add button is clicked").toBeTruthy();
    expect((postCall?.[1] as { body?: { label?: string; section?: string } }).body).toMatchObject({
      label: "Pull the permit",
      section: "field",
    });
  });
});

describe("JobDetailScreen Edit Job navigation", () => {
  // Regression: the Edit Job button was a silent no-op in production. Probe
  // diagnosis proved the client router fetched a valid RSC flight for
  // /jobs/[id]/edit but never committed the soft navigation (router.push AND
  // <Link> both drive that broken path). The fix renders a plain anchor to the
  // edit route so the browser performs a full-document navigation to the
  // proven-good URL. Contract under test: an anchor carrying the edit href is
  // present for office roles and absent for technicians.
  it("renders Edit Job as an anchor to the job's edit route for office roles", async () => {
    authState.role = "owner";
    const container = await renderScreen();

    const editLink = [...container.querySelectorAll("a")].find((anchor) =>
      anchor.textContent?.includes("Edit Job"),
    );

    expect(editLink, "expected an Edit Job link").toBeTruthy();
    expect(editLink?.getAttribute("href")).toBe("/jobs/job-1/edit");
  });

  it("does not render Edit Job for technicians", async () => {
    authState.role = "tech";
    const container = await renderScreen();

    const editLink = [...container.querySelectorAll("a")].find((anchor) =>
      anchor.textContent?.includes("Edit Job"),
    );
    const editButton = findButton(container, "Edit Job");

    expect(editLink).toBeUndefined();
    expect(editButton).toBeUndefined();
  });
});
