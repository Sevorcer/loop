import { describe, expect, it } from "vitest";

import {
  buildCustomerDirectionsUrl,
  buildDirectionsUrl,
  getPrimaryAdvance,
} from "../utils/jobMobileActions";

describe("getPrimaryAdvance", () => {
  it("advances a Scheduled job to In Progress with the Start Job label", () => {
    expect(getPrimaryAdvance("Scheduled")).toEqual({
      status: "In Progress",
      label: "Start Job",
    });
  });

  it("advances an In Progress job to Completed with the Mark Complete label", () => {
    expect(getPrimaryAdvance("In Progress")).toEqual({
      status: "Completed",
      label: "Mark Complete",
    });
  });

  it("resumes an On Hold job to In Progress with the Resume Job label", () => {
    expect(getPrimaryAdvance("On Hold")).toEqual({
      status: "In Progress",
      label: "Resume Job",
    });
  });

  it("returns null for terminal statuses", () => {
    expect(getPrimaryAdvance("Completed")).toBeNull();
    expect(getPrimaryAdvance("Cancelled")).toBeNull();
  });
});

describe("buildDirectionsUrl", () => {
  it("builds a Google Maps search URL for a job location", () => {
    expect(buildDirectionsUrl("123 Main St, Seattle, WA")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Seattle%2C%20WA",
    );
  });

  it("returns null for an empty location", () => {
    expect(buildDirectionsUrl("   ")).toBeNull();
  });
});

describe("buildCustomerDirectionsUrl", () => {
  it("joins street, city, and ZIP into one query", () => {
    expect(buildCustomerDirectionsUrl("123 Main St", "Seattle", "98101")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Seattle%2C%2098101",
    );
  });

  it("skips missing parts", () => {
    expect(buildCustomerDirectionsUrl(null, "Seattle", null)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Seattle",
    );
  });

  it("returns null when no address parts exist", () => {
    expect(buildCustomerDirectionsUrl(null, null, null)).toBeNull();
  });
});
