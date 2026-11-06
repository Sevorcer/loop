// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JobCompletionChecklistCard } from "../components/JobCompletionChecklistCard";
import { finalScheduledDayBlocker } from "../utils/jobFinalDay";
import type { JobCloseoutMode } from "../types/job";

const BLOCKER =
  "this job runs through Nov 4, 2026 and cannot be completed before its final scheduled day";

const QA_DONE = {
  startupVerificationComplete: true,
  safetyReviewComplete: true,
  workAreaCleaned: true,
};

const roots: Root[] = [];

async function renderCard(props: {
  closeoutMode?: JobCloseoutMode;
  finalDayBlocker?: string | null;
  allDone?: boolean;
}) {
  const allDone = props.allDone ?? true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      createElement(JobCompletionChecklistCard, {
        photosUploaded: allDone,
        installedSystemsEntered: allDone,
        jobNotesCompleted: allDone,
        closeoutMode: props.closeoutMode,
        finalDayBlocker: props.finalDayBlocker,
        initialChecklist: allDone
          ? QA_DONE
          : { startupVerificationComplete: false, safetyReviewComplete: false, workAreaCleaned: false },
        onSaveChecklist: vi.fn(async () => {}),
      }),
    );
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
});

describe("JobCompletionChecklistCard — final-day block", () => {
  it("does not read ready before the final day, and names the end date (full mode)", async () => {
    const container = await renderCard({ finalDayBlocker: BLOCKER });

    expect(
      container.querySelector('[data-checklist-blocker="final-day"]')?.textContent,
    ).toContain(
      "This job runs through Nov 4, 2026 and cannot be completed before its final scheduled day.",
    );
    expect(container.textContent).not.toContain("Completion checklist ready.");
    expect(container.textContent).toContain(
      "this job can be marked complete on its final scheduled day",
    );
  });

  it("does not read ready before the final day in visit mode either", async () => {
    const container = await renderCard({ closeoutMode: "visit", finalDayBlocker: BLOCKER });

    expect(container.querySelector('[data-checklist-blocker="final-day"]')).toBeTruthy();
    expect(container.textContent).not.toContain("this visit job can be marked complete.");
  });

  it("reads ready with no blocker (final day, or a single-day job)", async () => {
    const container = await renderCard({ finalDayBlocker: null });

    expect(container.querySelector('[data-checklist-blocker="final-day"]')).toBeNull();
    expect(container.textContent).toContain("Completion checklist ready.");
  });

  it("keeps the usual missing-items message when items are also missing", async () => {
    const container = await renderCard({ finalDayBlocker: BLOCKER, allDone: false });

    expect(container.textContent).toContain(
      "Complete all checklist items before finishing this job.",
    );
  });
});

describe("JobCompletionChecklistCard — no-system attestation", () => {
  async function renderAttestationCard(props: {
    closeoutMode?: JobCloseoutMode;
    installedSystemsEntered?: boolean;
    noSystemInstalled?: boolean;
    onToggle?: (value: boolean) => Promise<void>;
    initialChecklist?: typeof QA_DONE;
  }) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => {
      root.render(
        createElement(JobCompletionChecklistCard, {
          photosUploaded: true,
          installedSystemsEntered: props.installedSystemsEntered ?? false,
          jobNotesCompleted: true,
          closeoutMode: props.closeoutMode,
          initialChecklist: props.initialChecklist ?? QA_DONE,
          onSaveChecklist: vi.fn(async () => {}),
          noSystemInstalled: props.noSystemInstalled ?? false,
          onToggleNoSystemInstalled: props.onToggle,
        }),
      );
    });
    return container;
  }

  function attestationCheckbox(container: HTMLElement) {
    return [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("No system was installed on this job"),
    )?.querySelector("input");
  }

  it("offers the checkbox in full mode when no system is entered, and checking it readies the card", async () => {
    const onToggle = vi.fn(async () => {});
    const container = await renderAttestationCard({ onToggle });

    const checkbox = attestationCheckbox(container);
    expect(checkbox).toBeTruthy();
    expect(container.textContent).not.toContain("Completion checklist ready.");

    await act(async () => {
      checkbox!.click();
    });

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(container.textContent).toContain("Completion checklist ready.");
  });

  it("renders the attestation already checked when the job carries it", async () => {
    const container = await renderAttestationCard({
      noSystemInstalled: true,
      onToggle: vi.fn(async () => {}),
    });

    expect(attestationCheckbox(container)?.checked).toBe(true);
    expect(container.textContent).toContain("Completion checklist ready.");
  });

  it("excuses startup verification once attested, and labels it not required", async () => {
    const container = await renderAttestationCard({
      noSystemInstalled: true,
      onToggle: vi.fn(async () => {}),
      initialChecklist: {
        startupVerificationComplete: false,
        safetyReviewComplete: true,
        workAreaCleaned: true,
      },
    });

    expect(container.textContent).toContain(
      "Startup verification complete (not required — no system installed)",
    );
    expect(container.textContent).toContain("Completion checklist ready.");
  });

  it("still requires startup verification when not attested", async () => {
    const container = await renderAttestationCard({
      onToggle: vi.fn(async () => {}),
      initialChecklist: {
        startupVerificationComplete: false,
        safetyReviewComplete: true,
        workAreaCleaned: true,
      },
    });

    expect(container.textContent).not.toContain("not required — no system installed");
    expect(container.textContent).not.toContain("Completion checklist ready.");
  });

  it("shows no checkbox in visit mode or once a system is entered", async () => {
    const visit = await renderAttestationCard({
      closeoutMode: "visit",
      onToggle: vi.fn(async () => {}),
    });
    expect(attestationCheckbox(visit)).toBeFalsy();

    const entered = await renderAttestationCard({
      installedSystemsEntered: true,
      onToggle: vi.fn(async () => {}),
    });
    expect(attestationCheckbox(entered)).toBeFalsy();
  });
});

describe("finalScheduledDayBlocker (client-safe util)", () => {
  const job = {
    scheduledStartAt: "2026-11-03T16:00:00.000Z",
    scheduledEndAt: "2026-11-04T16:00:00.000Z",
  };

  it("blocks before the final day and clears on it", () => {
    expect(finalScheduledDayBlocker(job, "2026-11-03")).toBe(BLOCKER);
    expect(finalScheduledDayBlocker(job, "2026-11-04")).toBeNull();
  });

  it("never blocks a single-day job", () => {
    expect(
      finalScheduledDayBlocker({ scheduledStartAt: job.scheduledStartAt, scheduledEndAt: null }, "2026-11-01"),
    ).toBeNull();
  });
});
