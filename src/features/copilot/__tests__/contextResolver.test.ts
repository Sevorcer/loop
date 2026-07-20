import { describe, expect, it } from "vitest";

import { resolveCopilotContext } from "../contextResolver";

describe("resolveCopilotContext", () => {
  it("extracts job context from pathname", () => {
    expect(resolveCopilotContext({ pathname: "/jobs/job-001" })).toMatchObject({
      domain: "jobs",
      jobId: "job-001",
    });
  });

  it("extracts property context from pathname", () => {
    expect(resolveCopilotContext({ pathname: "/properties/2" })).toMatchObject({
      domain: "properties",
      propertyId: "2",
    });
  });

  it("extracts portal context from pathname", () => {
    expect(resolveCopilotContext({ pathname: "/portal/proj-0001/photos" })).toMatchObject({
      domain: "portal",
      projectId: "proj-0001",
      stage: "photos",
    });
  });

  it("uses supplied context ids when provided", () => {
    expect(resolveCopilotContext({ pathname: "/dashboard", propertyId: "99" })).toMatchObject({
      domain: "dashboard",
      propertyId: "99",
    });
  });
});
