// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobCloseoutMode } from "../types/job";
import type { JobCompletionChecklistStatus } from "../utils/jobCompletionChecklist";
import {
  buildCloseoutSteps,
  closeoutPanelModeLabel,
  JOB_CLOSEOUT_SECTION_IDS,
} from "../utils/jobCloseout";

const authState = vi.hoisted(() => ({ role: "owner" }));
const requestJson = vi.hoisted(() => vi.fn());

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

import { JobCloseoutPanel } from "../components/JobCloseoutPanel";

type ChecklistPayload = JobCompletionChecklistStatus & {
  closeoutMode: JobCloseoutMode;
};

const ALL_MISSING: ChecklistPayload = {
  photosUploaded: false,
  installedSystemsEntered: false,
  jobNotesCompleted: false,
  requiredQaItemsComplete: false,
  customerSignaturePlaceholder: "optional",
  finalDayBlocker: null,
  canComplete: false,
  closeoutMode: "full",
  requiresInstallGates: true,
};

const ALL_DONE: ChecklistPayload = {
  photosUploaded: true,
  installedSystemsEntered: true,
  jobNotesCompleted: true,
  requiredQaItemsComplete: true,
  customerSignaturePlaceholder: "optional",
  finalDayBlocker: null,
  canComplete: true,
  closeoutMode: "full",
};

const FINAL_DAY_BLOCKER =
  "this job runs through Nov 4, 2026 and cannot be completed before its final scheduled day";

const roots: Root[] = [];
let currentChecklist: ChecklistPayload = ALL_MISSING;
let onAddNote: ReturnType<typeof vi.fn>;
let onUpdateStatus: ReturnType<typeof vi.fn>;

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

async function renderPanel(status: "In Progress" | "Scheduled" = "In Progress") {
  return render(
    createElement(JobCloseoutPanel, {
      jobId: "job-1",
      status,
      onAddNote,
      onUpdateStatus,
    }),
  );
}

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((button) =>
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

async function openPanel(container: HTMLElement) {
  await click(findButton(container, "Start closeout"));
}

beforeEach(() => {
  authState.role = "owner";
  currentChecklist = ALL_MISSING;
  onAddNote = vi.fn(async () => {});
  onUpdateStatus = vi.fn(async () => {});
  requestJson.mockReset();
  requestJson.mockImplementation(async (url: string) => {
    if (url.includes("completion-checklist")) {
      return { checklist: currentChecklist };
    }
    throw new Error(`Unexpected request: ${url}`);
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

describe("buildCloseoutSteps", () => {
  it("lists the four steps in work order with the checklist's states", () => {
    const steps = buildCloseoutSteps({
      ...ALL_MISSING,
      jobNotesCompleted: true,
      photosUploaded: true,
    });

    expect(steps.map((step) => step.key)).toEqual(["note", "photo", "qa", "systems"]);
    expect(steps.map((step) => step.complete)).toEqual([true, true, false, false]);
    expect(steps[0].sectionId).toBeNull();
    expect(steps[1].sectionId).toBe(JOB_CLOSEOUT_SECTION_IDS.photos);
    expect(steps[2].sectionId).toBe(JOB_CLOSEOUT_SECTION_IDS.qa);
    expect(steps[3].sectionId).toBe(JOB_CLOSEOUT_SECTION_IDS.systems);
  });

  it("completes the systems step on the no-system attestation alone", () => {
    const steps = buildCloseoutSteps({ ...ALL_MISSING, noSystemInstalled: true });

    const systems = steps.find((step) => step.key === "systems");
    expect(systems?.complete).toBe(true);
    expect(systems?.hint).toContain("no system installed");
  });

  it("returns only the note step in visit mode", () => {
    const steps = buildCloseoutSteps({ ...ALL_MISSING, closeoutMode: "visit" });

    expect(steps.map((step) => step.key)).toEqual(["note"]);
    expect(steps[0].complete).toBe(false);

    const notedSteps = buildCloseoutSteps({
      ...ALL_MISSING,
      closeoutMode: "visit",
      jobNotesCompleted: true,
    });

    expect(notedSteps.map((step) => step.key)).toEqual(["note"]);
    expect(notedSteps[0].complete).toBe(true);
  });
});

describe("closeoutPanelModeLabel", () => {
  it("labels known modes and tolerates a missing field", () => {
    expect(closeoutPanelModeLabel(undefined)).toBeNull();
    expect(closeoutPanelModeLabel(null)).toBeNull();
    expect(closeoutPanelModeLabel("visit")).toBe("Visit closeout — note only");
    expect(closeoutPanelModeLabel("full")).toBe("Full closeout");
  });
});

describe("JobCloseoutPanel", () => {
  it("does not fetch until opened, then lists every step as missing and keeps Complete disabled", async () => {
    const container = await renderPanel();

    expect(requestJson).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Start closeout");

    await openPanel(container);

    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(String(requestJson.mock.calls[0][0])).toContain(
      "/api/jobs/job-1/completion-checklist",
    );
    for (const label of ["Job note", "Photo", "QA checklist", "Installed systems"]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.querySelector("textarea")).toBeTruthy();
    expect(findButton(container, "Go to Photos & Files")).toBeTruthy();
    expect(findButton(container, "Complete job")?.disabled).toBe(true);
  });

  it("saving the note writes it and refetches so the step flips done", async () => {
    onAddNote = vi.fn(async () => {
      currentChecklist = { ...ALL_MISSING, jobNotesCompleted: true };
    });
    const container = await renderPanel();
    await openPanel(container);

    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(textarea, "Install finished, system running.");
      textarea!.dispatchEvent(new window.Event("input", { bubbles: true }));
    });

    await click(findButton(container, "Save note"));

    expect(onAddNote).toHaveBeenCalledWith("Install finished, system running.");
    // One fetch on open, one refetch after the save.
    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).toContain("Done");
  });

  it("enables Complete when the checklist allows it and completes the job", async () => {
    currentChecklist = ALL_DONE;
    const container = await renderPanel();
    await openPanel(container);

    const completeButton = findButton(container, "Complete job");
    expect(completeButton?.disabled).toBe(false);

    await click(completeButton);

    expect(onUpdateStatus).toHaveBeenCalledWith("Completed");
    expect(container.textContent).toContain("Job closed out");
  });

  it("shows the completion failure when the server still refuses", async () => {
    currentChecklist = ALL_DONE;
    onUpdateStatus = vi.fn(async () => {
      throw new Error("Cannot complete job — missing job notes.");
    });
    const container = await renderPanel();
    await openPanel(container);

    await click(findButton(container, "Complete job"));

    expect(container.textContent).toContain("This job was not marked complete.");
    expect(container.textContent).toContain("Job notes");
  });

  it("shows the closeout mode label when the payload carries one", async () => {
    currentChecklist = { ...ALL_MISSING, closeoutMode: "visit" };
    const container = await renderPanel();
    await openPanel(container);

    expect(container.textContent).toContain("Visit closeout — note only");
  });

  it("shows only the note step in visit mode", async () => {
    currentChecklist = { ...ALL_MISSING, closeoutMode: "visit" };
    const container = await renderPanel();
    await openPanel(container);

    expect(container.textContent).toContain("Job note");
    expect(container.textContent).toContain("Visit closeout — note only");
    expect(container.textContent).not.toContain("QA checklist");
    expect(container.textContent).not.toContain("Installed systems");
    expect(container.querySelector("textarea")).toBeTruthy();
    expect(findButton(container, "Go to Photos & Files")).toBeUndefined();
    expect(findButton(container, "Complete job")?.disabled).toBe(true);
  });

  it("completes a visit job once the note is in, with no other steps required", async () => {
    currentChecklist = {
      ...ALL_MISSING,
      closeoutMode: "visit",
      requiresInstallGates: false,
      jobNotesCompleted: true,
      canComplete: true,
    };
    const container = await renderPanel();
    await openPanel(container);

    expect(container.textContent).not.toContain("QA checklist");
    expect(container.textContent).not.toContain("Installed systems");
    const completeButton = findButton(container, "Complete job");
    expect(completeButton?.disabled).toBe(false);

    await click(completeButton);

    expect(onUpdateStatus).toHaveBeenCalledWith("Completed");
    expect(container.textContent).toContain("Job closed out");
  });

  it("lists the final-day blocker and never shows clear while it stands (full mode)", async () => {
    // Rehearsal repro: every step done on Nov 3, job runs Nov 3–4.
    currentChecklist = {
      ...ALL_DONE,
      finalDayBlocker: FINAL_DAY_BLOCKER,
      canComplete: false,
    };
    const container = await renderPanel();
    await openPanel(container);

    const blocker = container.querySelector('[data-closeout-blocker="final-day"]');
    expect(blocker).toBeTruthy();
    expect(blocker?.textContent).toContain(
      "This job runs through Nov 4, 2026 and cannot be completed before its final scheduled day.",
    );
    expect(container.textContent).not.toContain("you're clear to complete");
    expect(findButton(container, "Complete job")?.disabled).toBe(true);
  });

  it("keeps Complete disabled on the blocker even if canComplete were true", async () => {
    currentChecklist = { ...ALL_DONE, finalDayBlocker: FINAL_DAY_BLOCKER };
    const container = await renderPanel();
    await openPanel(container);

    expect(container.textContent).not.toContain("you're clear to complete");
    expect(findButton(container, "Complete job")?.disabled).toBe(true);
  });

  it("lists the final-day blocker for a visit-mode multi-day job too", async () => {
    currentChecklist = {
      ...ALL_MISSING,
      closeoutMode: "visit",
      requiresInstallGates: false,
      jobNotesCompleted: true,
      finalDayBlocker: FINAL_DAY_BLOCKER,
      canComplete: false,
    };
    const container = await renderPanel();
    await openPanel(container);

    expect(
      container.querySelector('[data-closeout-blocker="final-day"]')?.textContent,
    ).toContain("Nov 4, 2026");
    expect(container.textContent).not.toContain("you're clear to complete");
    expect(findButton(container, "Complete job")?.disabled).toBe(true);
  });

  it("shows no final-day blocker when the payload carries none", async () => {
    currentChecklist = ALL_DONE;
    const container = await renderPanel();
    await openPanel(container);

    expect(container.querySelector('[data-closeout-blocker="final-day"]')).toBeNull();
    expect(container.textContent).toContain("you're clear to complete this job");
  });

  it("renders nothing when completing is not a valid transition", async () => {
    const container = await renderPanel("Scheduled");

    expect(container.textContent).not.toContain("Start closeout");
    expect(requestJson).not.toHaveBeenCalled();
  });
});
