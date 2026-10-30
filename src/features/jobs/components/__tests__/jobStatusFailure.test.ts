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
});
