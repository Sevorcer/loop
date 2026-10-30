import { describe, expect, it } from "vitest";

import {
  buildCallbackJobInput,
  callbackReasonError,
  canCreateCallback,
  isCallbackJob,
  jobTypeFilterLabel,
  type CallbackSourceJob,
} from "../callbackJob";

const original: CallbackSourceJob = {
  id: "job-1",
  jobNumber: "JOB-1008",
  title: "No cool upstairs",
  customerId: "cus-1",
  customerName: "Ada Lovelace",
  propertyId: "prop-1",
  propertyName: "12 Market St",
  assignedTo: "Antonio",
  assigneeIds: ["tech-1"],
  estimateId: "est-9",
  equipmentBundleId: "bundle-4",
  contractorIds: ["con-1"],
  location: "12 Market St, Salem",
  summary: "Upstairs system short cycles.",
  priority: "High",
};

describe("callback jobs", () => {
  it("lets office and dispatch create a return visit", () => {
    expect(canCreateCallback("office")).toBe(true);
    expect(canCreateCallback("dispatch")).toBe(true);
    expect(canCreateCallback("owner")).toBe(true);
    expect(canCreateCallback("manager")).toBe(true);
  });

  it("keeps technicians and sales from creating a return visit", () => {
    expect(canCreateCallback("tech")).toBe(false);
    expect(canCreateCallback("sales")).toBe(false);
    expect(canCreateCallback(null)).toBe(false);
  });

  it("requires a reason", () => {
    expect(callbackReasonError("  ")).toBe("Enter the reason for the return visit.");
    expect(callbackReasonError("Still not cooling")).toBeNull();
  });

  it("copies the customer, property, and equipment onto a Callback job", () => {
    const draft = buildCallbackJobInput(original, {
      reason: "  Still not cooling  ",
      scheduledStartAt: null,
    });

    expect(draft.type).toBe("Callback");
    expect(draft.title).toBe("Callback: No cool upstairs");
    expect(draft.customerId).toBe("cus-1");
    expect(draft.customerName).toBe("Ada Lovelace");
    expect(draft.propertyId).toBe("prop-1");
    expect(draft.propertyName).toBe("12 Market St");
    expect(draft.equipmentBundleId).toBe("bundle-4");
    expect(draft.estimateId).toBe("est-9");
    expect(draft.contractorIds).toEqual(["con-1"]);
    expect(draft.assigneeIds).toEqual(["tech-1"]);
    expect(draft.assignedTo).toBe("Antonio");
    expect(draft.location).toBe("12 Market St, Salem");
    expect(draft.priority).toBe("High");
    expect(draft.notes).toBe("Still not cooling");
    expect(draft.summary).toContain("JOB-1008");
    expect(draft.summary).toContain("Still not cooling");
    expect(draft.scheduledStartAt).toBeNull();
  });

  it("labels callback jobs for filters", () => {
    expect(isCallbackJob("Callback")).toBe(true);
    expect(isCallbackJob("Service")).toBe(false);
    expect(jobTypeFilterLabel("Callback")).toBe("Callback (return visit)");
    expect(jobTypeFilterLabel("Install")).toBe("Install");
  });
});
