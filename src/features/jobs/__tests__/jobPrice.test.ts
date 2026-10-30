import { describe, expect, it } from "vitest";

import {
  JOB_PRICE_REDACTED_DESCRIPTION,
  jobPriceActivityCopy,
  redactJobPriceActivity,
} from "../utils/jobPrice";

describe("job price timeline", () => {
  it("names who changed the price and does not include an amount", () => {
    const descriptions = [
      jobPriceActivityCopy("Alex Nguyen", "set").description,
      jobPriceActivityCopy("Alex Nguyen", "changed").description,
      jobPriceActivityCopy("Alex Nguyen", "cleared").description,
    ];
    expect(descriptions).toEqual([
      "Alex Nguyen set the job price.",
      "Alex Nguyen changed the job price.",
      "Alex Nguyen cleared the job price.",
    ]);
    for (const description of descriptions) {
      expect(description).not.toMatch(/\$|\d/);
    }
  });

  it("still redacts a price row that somehow contains an amount", () => {
    const items = [
      {
        type: "price" as const,
        description: "Alex Nguyen changed the job price from $1,000.00 to $1,200.50.",
      },
      { type: "price" as const, description: "Alex Nguyen changed the job price." },
      { type: "status" as const, description: "Status changed." },
    ];
    const hidden = redactJobPriceActivity(items, false);
    expect(hidden[0]?.description).toBe(JOB_PRICE_REDACTED_DESCRIPTION);
    expect(hidden[1]?.description).toBe("Alex Nguyen changed the job price.");
    expect(JSON.stringify(hidden[0])).not.toContain("1,200");
    expect(JSON.stringify(hidden[0])).not.toContain("$");
    expect(hidden[2]?.description).toBe("Status changed.");
    expect(redactJobPriceActivity(items, true)[0]?.description).toBe(JOB_PRICE_REDACTED_DESCRIPTION);
  });
});
