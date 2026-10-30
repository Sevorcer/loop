import { describe, expect, it } from "vitest";

import { completionBlockers } from "../jobCompletionChecklist";

describe("completion blockers", () => {
  it("lists every missing item from the server rejection", () => {
    expect(
      completionBlockers(
        "Cannot complete job — missing at least one photo, missing installed systems, missing job notes, incomplete required QA items.",
      ),
    ).toEqual(["At least one photo", "Installed systems", "Job notes", "Required QA items"]);
  });

  it("leaves other status errors as a single message", () => {
    expect(completionBlockers("Invalid transition: job cannot move from 'Scheduled' to 'Completed'.")).toEqual(
      [],
    );
  });
});
