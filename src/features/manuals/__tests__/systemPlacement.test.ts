import { describe, expect, it } from "vitest";

import { buildSystemPlacement, pickPlacementJob, technicalRecordFields } from "../utils/systemPlacement";

const job = (id: string, scheduledFor: string | null) => ({ id, jobNumber: `J-${id}`, title: "Install", type: "Install", status: "Completed", scheduledFor });

describe("system placement", () => {
  it("prefers the linked job", () => {
    expect(pickPlacementJob({ installDate: "2024-05-01" }, job("L", "2020-01-01"), [job("A", "2024-05-02")])?.basis).toBe("linked");
  });

  it("matches a property install job by install date within 60 days", () => {
    const picked = pickPlacementJob({ installDate: "2024-05-01" }, null, [job("far", "2023-01-01"), job("near", "2024-04-20"), job("late", "2025-02-01")]);
    expect(picked).toMatchObject({ id: "near", basis: "install_date" });
  });

  it("falls back to the latest install job, or null", () => {
    expect(pickPlacementJob({ installDate: "" }, null, [job("a", "2022-01-01"), job("b", "2024-01-01")])).toMatchObject({ id: "b", basis: "latest_install" });
    expect(pickPlacementJob({ installDate: "2024-05-01" }, null, [job("x", "2019-01-01")])).toMatchObject({ basis: "latest_install" });
    expect(pickPlacementJob({ installDate: null }, null, [])).toBeNull();
  });

  it("keeps technical custom fields and drops PII-ish ones", () => {
    expect(
      technicalRecordFields({
        custom_fields: {
          "Filter Size(s)": "16x25x1",
          "Belt Size": "4L360",
          "Retail Space Customer": "Some Tenant LLC",
          "Equipment information": "call 503-555-1212",
          "Gate code": "1234",
          "Last Belt Change (commercial)": "",
        },
      }),
    ).toEqual([
      { label: "Belt Size", value: "4L360" },
      { label: "Filter Size(s)", value: "16x25x1" },
    ]);
    expect(technicalRecordFields(null)).toEqual([]);
    expect(technicalRecordFields({ custom_fields: [] })).toEqual([]);
  });

  it("builds nameplate facts and hides 'Unknown'", () => {
    const placement = buildSystemPlacement(
      { manufacturer: "Mitsubishi", modelNumber: "Unknown", serialNumbers: ["123", " "], installDate: "", location: "Attic", systemName: "x", jobId: null, attributes: null },
      null,
      [],
    );
    expect(placement.nameplate).toEqual([
      { label: "Manufacturer", value: "Mitsubishi" },
      { label: "Serial", value: "123" },
      { label: "Location", value: "Attic" },
    ]);
    expect(placement.job).toBeNull();
  });
});
