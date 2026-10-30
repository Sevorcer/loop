import { describe, expect, it } from "vitest";

import {
  JOB_PRICE_REDACTED_DESCRIPTION,
  jobPriceActivityCopy,
  redactJobPriceActivity,
} from "../utils/jobPrice";

describe("job price timeline", () => {
  it("records who set, changed, or cleared the price", () => {
    expect(
      jobPriceActivityCopy({ previousCents: null, nextCents: 120050, actorName: "Alex Nguyen" }).description,
    ).toBe("Alex Nguyen set the job price to $1,200.50.");
    expect(
      jobPriceActivityCopy({ previousCents: 100000, nextCents: 90000, actorName: "Alex Nguyen" }).description,
    ).toBe("Alex Nguyen changed the job price from $1,000.00 to $900.00.");
    expect(
      jobPriceActivityCopy({ previousCents: 100000, nextCents: null, actorName: "Alex Nguyen" }).description,
    ).toContain("cleared the job price");
  });

  it("hides the amount from roles that cannot see revenue", () => {
    const items = [
      {
        type: "price" as const,
        description: "Alex Nguyen set the job price to $1,200.50.",
      },
      { type: "status" as const, description: "Status changed." },
    ];
    const hidden = redactJobPriceActivity(items, false);
    expect(hidden[0]?.description).toBe(JOB_PRICE_REDACTED_DESCRIPTION);
    expect(JSON.stringify(hidden)).not.toContain("1,200");
    expect(hidden[1]?.description).toBe("Status changed.");
    expect(redactJobPriceActivity(items, true)[0]?.description).toContain("$1,200.50");
  });
});
