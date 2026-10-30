import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { showAddContractorLink } from "@/features/jobs/utils/contractorAccess";
import { editJobIdentityValues } from "@/features/jobs/utils/editJobInitialValues";
import { applyFileDownload } from "@/features/jobs/utils/fileDownload";
import { canSubmitJobForm, type JobFormSubmitFields } from "@/features/jobs/utils/jobFormSubmit";

const officeForm: JobFormSubmitFields = {
  title: "Replace condenser",
  customerName: "Ada Lovelace",
  propertyName: "12 Market St",
  assignedTo: "Antonio",
  location: "Roof",
  summary: "Unit is down",
  scheduledStartAt: "2026-10-30T09:00",
};

const clearWindows = { scheduledWindowError: null, arrivalWindowError: null };

describe("tech job edit Save", () => {
  it("lets a technician save with location and summary only", () => {
    const techForm: JobFormSubmitFields = {
      ...officeForm,
      title: "",
      customerName: "",
      propertyName: "",
      assignedTo: "",
      scheduledStartAt: "",
    };

    expect(canSubmitJobForm("tech", techForm, clearWindows)).toBe(true);
  });

  it("keeps Save off when a technician leaves location or summary blank", () => {
    expect(
      canSubmitJobForm("tech", { ...officeForm, location: "  " }, clearWindows),
    ).toBe(false);
    expect(
      canSubmitJobForm("tech", { ...officeForm, summary: "" }, clearWindows),
    ).toBe(false);
  });

  it("keeps Save off when a time window is invalid", () => {
    expect(
      canSubmitJobForm("tech", officeForm, {
        scheduledWindowError: "End is before start",
        arrivalWindowError: null,
      }),
    ).toBe(false);
  });

  it("still requires the office fields for an owner", () => {
    expect(canSubmitJobForm("owner", officeForm, clearWindows)).toBe(true);
    expect(
      canSubmitJobForm("owner", { ...officeForm, assignedTo: "" }, clearWindows),
    ).toBe(false);
    expect(
      canSubmitJobForm("owner", { ...officeForm, scheduledStartAt: "" }, clearWindows),
    ).toBe(false);
  });
});

describe("edit job initial values", () => {
  it("keeps the customer and property ids so Save does not create new records", () => {
    const values = editJobIdentityValues({
      estimateId: "est-1",
      title: "Service call",
      customerName: "Ada Lovelace",
      customerId: "cus-1",
      propertyName: "12 Market St",
      propertyId: "prop-1",
      assignedTo: "Antonio",
      assignees: [{ id: "tech-1" }],
      type: "Service",
      priority: "Medium",
      location: "Roof",
      summary: "No cool",
      notes: "",
    });

    expect(values.customerId).toBe("cus-1");
    expect(values.propertyId).toBe("prop-1");
    expect(values.assigneeIds).toEqual(["tech-1"]);
  });
});

describe("contractor Add one link", () => {
  it("hides the link for a technician and shows it for the office", () => {
    expect(showAddContractorLink("tech")).toBe(false);
    expect(showAddContractorLink("owner")).toBe(true);
    expect(showAddContractorLink("manager")).toBe(true);
  });
});

describe("photo download", () => {
  it("saves the file in this tab instead of opening a new one", () => {
    const link = { href: "", download: "", rel: "", target: "_blank" };
    applyFileDownload(link, "https://files.example/photo.jpg", "photo.jpg");

    expect(link.href).toBe("https://files.example/photo.jpg");
    expect(link.download).toBe("photo.jpg");
    expect(link.target).toBe("");
    expect(link.target).not.toBe("_blank");
  });

  it("does not set target=_blank on the job file download click", () => {
    const source = readFileSync(
      new URL("../components/JobFilesPanel.tsx", import.meta.url),
      "utf8",
    );
    const downloadHandler = source.slice(
      source.indexOf("async function handleDownload"),
      source.indexOf("async function handleDelete"),
    );
    expect(downloadHandler).toContain("applyFileDownload");
    expect(downloadHandler).not.toContain('target = "_blank"');
    expect(downloadHandler).not.toContain("target=\"_blank\"");
  });
});
