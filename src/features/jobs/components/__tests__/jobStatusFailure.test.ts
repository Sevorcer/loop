// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { JobStatusFailure } from "../JobStatusActions";

describe("job status failure", () => {
  it("keeps the rejection on screen as a list and does not claim the job is completed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(JobStatusFailure, {
          message:
            "Cannot complete job — missing at least one photo, missing installed systems, missing job notes, incomplete required QA items.",
        }),
      );
    });

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toContain("This job was not marked complete");
    expect(alert?.textContent).toContain("Still needed");
    expect(alert?.textContent).toContain("At least one photo");
    expect(alert?.textContent).toContain("Installed systems");
    expect(alert?.textContent).toContain("Job notes");
    expect(alert?.textContent).toContain("Required QA items");
    expect(alert?.textContent).not.toContain("Job moved to Completed");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the multi-day final-day refusal as one item with the date intact", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(JobStatusFailure, {
          message:
            "Cannot complete job — this job runs through Nov 4, 2026 and cannot be completed before its final scheduled day.",
        }),
      );
    });

    const items = [...container.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual([
      "This job runs through Nov 4, 2026 and cannot be completed before its final scheduled day",
    ]);

    await act(async () => {
      root.unmount();
    });
  });
});
