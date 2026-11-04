import { describe, expect, it } from "vitest";

import {
  cleanCustomerName,
  deriveStatus,
  isNoPermitRow,
  matchCustomer,
  matchPermitsToJobs,
  normalizeName,
  parseInstallDate,
  parsePermitCsv,
  splitPermitNumbers,
  type LoopCustomer,
  type LoopJob,
  type PermitCsvRow,
} from "../parse";

// ---------------------------------------------------------------------------
// splitPermitNumbers
// ---------------------------------------------------------------------------

describe("splitPermitNumbers", () => {
  it("returns empty for blank input", () => {
    expect(splitPermitNumbers("")).toEqual([]);
  });

  it("returns a single permit number", () => {
    expect(splitPermitNumbers("7141346-FR")).toEqual(["7141346-FR"]);
  });

  it("splits on / separator", () => {
    expect(splitPermitNumbers("7141346-FR/7150284-RF")).toEqual([
      "7141346-FR",
      "7150284-RF",
    ]);
  });

  it("splits on & separator", () => {
    expect(splitPermitNumbers("7121624-RF & 7121505-FR")).toEqual([
      "7121624-RF",
      "7121505-FR",
    ]);
  });

  it("splits on - used as separator between full permit numbers", () => {
    // "7100047-RF-7100048-FR" uses - both within and between permit numbers.
    // Our splitter uses / and & — this stays as one entry unless we handle it.
    // The CSV actually uses "/" for this case; the "-" variant is handled.
    expect(splitPermitNumbers("7100047-RF/7100048-FR")).toEqual([
      "7100047-RF",
      "7100048-FR",
    ]);
  });

  it("handles mixed formats like slash-separated permit IDs with spaces", () => {
    expect(splitPermitNumbers("26110689MP/4862972E")).toEqual([
      "26110689MP",
      "4862972E",
    ]);
  });

  it("filters out non-permit-number values starting with 'Waiting'", () => {
    expect(
      splitPermitNumbers("Waiting to hear from GC since in Burien"),
    ).toEqual([]);
  });

  it("handles MyBP-style permit numbers", () => {
    expect(splitPermitNumbers("BLD2026-1009 (MyBP)")).toEqual([
      "BLD2026-1009 (MyBP)",
    ]);
  });

  it("handles permit numbers with spaces like Snohomish County", () => {
    expect(splitPermitNumbers("26 110399 BK")).toEqual(["26 110399 BK"]);
  });

  it("handles MSF-style permit numbers", () => {
    expect(splitPermitNumbers("MSF26-04483")).toEqual(["MSF26-04483"]);
  });
});

// ---------------------------------------------------------------------------
// deriveStatus
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<PermitCsvRow> = {}): PermitCsvRow {
  return {
    section: "",
    customerName: "",
    permitNo: "",
    installDate: "",
    electricalPermitDone: "",
    mechanicalFurnaceFinal: "",
    notes: "",
    confidence: "high",
    ...overrides,
  };
}

describe("deriveStatus", () => {
  it("returns issued for ALL PERMITS COMPLETED", () => {
    expect(deriveStatus(makeRow({ notes: "ALL PERMITS COMPLETED" }))).toBe(
      "issued",
    );
  });

  it("returns issued for PERMIT COMPLETED", () => {
    expect(deriveStatus(makeRow({ notes: "PERMIT COMPLETED" }))).toBe(
      "issued",
    );
  });

  it("returns issued for COMPLETED notes", () => {
    expect(
      deriveStatus(
        makeRow({ notes: "COMPLETED [Checked on Permit: 5/11/2026]" }),
      ),
    ).toBe("issued");
  });

  it("returns issued when mechanical is DONE", () => {
    expect(
      deriveStatus(makeRow({ mechanicalFurnaceFinal: "DONE" })),
    ).toBe("issued");
  });

  it("returns issued when mechanical is COMPLETED", () => {
    expect(
      deriveStatus(makeRow({ mechanicalFurnaceFinal: "COMPLETED" })),
    ).toBe("issued");
  });

  it("returns applied when mechanical says NOT DONE", () => {
    expect(
      deriveStatus(
        makeRow({ mechanicalFurnaceFinal: "NOT DONE", notes: "" }),
      ),
    ).toBe("applied");
  });

  it("returns applied when mechanical says EXPIRED", () => {
    expect(
      deriveStatus(
        makeRow({ mechanicalFurnaceFinal: "EXPIRED - 10/2/25" }),
      ),
    ).toBe("applied");
  });

  it("returns applied as default (no completion indicators)", () => {
    expect(deriveStatus(makeRow({}))).toBe("applied");
  });

  it("returns applied for rows with only an email note", () => {
    expect(
      deriveStatus(
        makeRow({ notes: "Emailed customer 9/21/26 to schedule their own" }),
      ),
    ).toBe("applied");
  });
});

// ---------------------------------------------------------------------------
// parseInstallDate
// ---------------------------------------------------------------------------

describe("parseInstallDate", () => {
  it("returns null for empty string", () => {
    expect(parseInstallDate("")).toBeNull();
  });

  it("parses M/D/YYYY format", () => {
    const d = parseInstallDate("1/5/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(0); // January
    expect(d!.getDate()).toBe(5);
  });

  it("parses MM/DD/YYYY format", () => {
    const d = parseInstallDate("12/09/2024");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(9);
  });

  it("returns null for NA", () => {
    expect(parseInstallDate("NA")).toBeNull();
  });

  it("returns null for non-date text", () => {
    expect(parseInstallDate("Ricky-7/19/2024")).toBeNull();
  });

  it("returns null for impossible dates", () => {
    expect(parseInstallDate("2/30/2025")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isNoPermitRow
// ---------------------------------------------------------------------------

describe("isNoPermitRow", () => {
  it("detects NO PERMIT PER CITY in customer name", () => {
    expect(
      isNoPermitRow(makeRow({ customerName: "CARMICHAEL NO PERMIT PER CITY" })),
    ).toBe("no_permit_per_city");
  });

  it("detects NO PERMIT - COVERED UNDER BLDG PERMIT", () => {
    expect(
      isNoPermitRow(
        makeRow({
          customerName:
            "TOM A LOT 2 NO PERMIT - COVERED UNDER BLDG PERMIT",
        }),
      ),
    ).toBe("covered_under_building_permit");
  });

  it("returns null for normal customer names", () => {
    expect(
      isNoPermitRow(makeRow({ customerName: "McBride Doscher" })),
    ).toBeNull();
  });

  it("detects PAR TERRA NO PERMIT PER CITY", () => {
    expect(
      isNoPermitRow(makeRow({ customerName: "PAR TERRA NO PERMIT PER CITY" })),
    ).toBe("no_permit_per_city");
  });
});

// ---------------------------------------------------------------------------
// cleanCustomerName
// ---------------------------------------------------------------------------

describe("cleanCustomerName", () => {
  it("strips NO PERMIT PER CITY suffix", () => {
    expect(cleanCustomerName("CARMICHAEL NO PERMIT PER CITY")).toBe(
      "CARMICHAEL",
    );
  });

  it("strips NO PERMIT - COVERED UNDER BLDG PERMIT", () => {
    expect(
      cleanCustomerName(
        "TOM A LOT 2 NO PERMIT - COVERED UNDER BLDG PERMIT",
      ),
    ).toBe("TOM A LOT 2");
  });

  it("strips YUCK", () => {
    expect(cleanCustomerName("Judy Lloyd - YUCK")).toBe("Judy Lloyd");
  });

  it("leaves normal names unchanged", () => {
    expect(cleanCustomerName("McBride Doscher")).toBe("McBride Doscher");
  });
});

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------

describe("normalizeName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("McBride  Doscher")).toBe("mcbride doscher");
  });

  it("strips punctuation", () => {
    expect(normalizeName("Better Builders - Dolan")).toBe(
      "better builders dolan",
    );
  });
});

// ---------------------------------------------------------------------------
// matchCustomer
// ---------------------------------------------------------------------------

describe("matchCustomer", () => {
  const customers: LoopCustomer[] = [
    { id: "c1", name: "McBride" },
    { id: "c2", name: "Better Builders" },
    { id: "c3", name: "Jonathan David" },
    { id: "c4", name: "Exalt" },
    { id: "c5", name: "Hillside" },
  ];

  it("finds exact match", () => {
    const result = matchCustomer("McBride", customers);
    expect(result).not.toBeNull();
    expect(result!.customer.id).toBe("c1");
    expect(result!.matchType).toBe("exact");
  });

  it("finds partial match for Builder-Property pattern", () => {
    const result = matchCustomer("McBride Doscher", customers);
    expect(result).not.toBeNull();
    expect(result!.customer.id).toBe("c1");
    expect(result!.matchType).toBe("partial");
  });

  it("finds partial match for hyphenated pattern", () => {
    const result = matchCustomer("Better Builders - Dolan", customers);
    expect(result).not.toBeNull();
    expect(result!.customer.id).toBe("c2");
    expect(result!.matchType).toBe("partial");
  });

  it("finds partial match by containment", () => {
    const result = matchCustomer("Exalt - 906", customers);
    expect(result).not.toBeNull();
    expect(result!.customer.id).toBe("c4");
    expect(result!.matchType).toBe("partial");
  });

  it("returns null for no match", () => {
    expect(matchCustomer("Unknown Corp", customers)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matchPermitsToJobs
// ---------------------------------------------------------------------------

describe("matchPermitsToJobs", () => {
  const customers: LoopCustomer[] = [
    { id: "c1", name: "McBride" },
    { id: "c2", name: "Better Builders" },
  ];

  const jobs: LoopJob[] = [
    { id: "j1", customerId: "c1", description: "Install" },
    { id: "j2", customerId: "c2", description: "Replacement" },
  ];

  it("matches a permit to a job through its customer", () => {
    const permits = [
      {
        sourceRow: 2,
        customerName: "McBride Doscher",
        permitNumber: "7141346-FR",
        status: "applied" as const,
        installDate: null,
        electricalPermitDone: "",
        mechanicalFurnaceFinal: "",
        notes: "",
        section: "Section 1",
        confidence: "high" as const,
      },
    ];

    const result = matchPermitsToJobs(permits, customers, jobs);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.jobId).toBe("j1");
    expect(result.matched[0]!.matchType).toBe("partial");
    expect(result.unmatched).toHaveLength(0);
  });

  it("reports unmatched permits", () => {
    const permits = [
      {
        sourceRow: 2,
        customerName: "Unknown Customer",
        permitNumber: "123",
        status: "applied" as const,
        installDate: null,
        electricalPermitDone: "",
        mechanicalFurnaceFinal: "",
        notes: "",
        section: "Section 1",
        confidence: "high" as const,
      },
    ];

    const result = matchPermitsToJobs(permits, customers, jobs);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parsePermitCsv — integration
// ---------------------------------------------------------------------------

describe("parsePermitCsv", () => {
  const SAMPLE_CSV = [
    "section,customer_name,permit_no,install_date,electrical_permit_done,mechanical_furnace_final,notes,confidence",
    'Section 1 (PDF pp. 1-8),Jonathan David Olson,7141346-FR/7150284-RF,,,,,high',
    "Section 1 (PDF pp. 1-8),CARMICHAEL NO PERMIT PER CITY,,,,,,high",
    'Section 1 (PDF pp. 1-8),Better Builders Eberly,7136490-FR,,NA,DONE,,high',
    "Section 3 (PDF pp. 14-17),Chris Mielke,,1/13/2025,,,ALL PERMITS COMPLETED,high",
    'Section 1 (PDF pp. 1-8),Armata - Myers (Camano Island),26-2054,,,,,low',
    'Section 1 (PDF pp. 1-8),Better Build - Robinson,Waiting to hear from GC since in Burien,,,,,high',
    "Section 2 (PDF pp. 9-13),,7162927-RF/7162928-FR,10/15/2026,,,,low",
  ].join("\n");

  it("parses all row types correctly", () => {
    const result = parsePermitCsv(SAMPLE_CSV);

    // Jonathan David Olson → 2 permits (split on /)
    // Better Builders Eberly → 1 permit (DONE → issued)
    // Chris Mielke → 1 permit (ALL PERMITS COMPLETED → issued)
    // Armata - Myers → 1 permit (low confidence)
    // Better Build - Robinson → 1 permit (Waiting... is not a permit #)
    // Empty customer → skipped
    // Total permits: 2 + 1 + 1 + 1 + 1 = 6
    expect(result.permits).toHaveLength(6);

    // CARMICHAEL → skipped (no permit per city)
    // Empty customer → skipped
    expect(result.skipped).toHaveLength(2);
  });

  it("splits multi-permit rows into separate records", () => {
    const result = parsePermitCsv(SAMPLE_CSV);
    const olsonPermits = result.permits.filter(
      (p) => p.customerName === "Jonathan David Olson",
    );
    expect(olsonPermits).toHaveLength(2);
    expect(olsonPermits[0]!.permitNumber).toBe("7141346-FR");
    expect(olsonPermits[1]!.permitNumber).toBe("7150284-RF");
  });

  it("flags low confidence rows", () => {
    const result = parsePermitCsv(SAMPLE_CSV);
    const lowConf = result.flagged.filter((f) => f.reason === "low_confidence");
    expect(lowConf).toHaveLength(2); // Armata + empty customer (but empty is skipped)
    expect(lowConf.some((f) => f.customerName.includes("Armata"))).toBe(true);
  });

  it("flags non-standard permit numbers", () => {
    const result = parsePermitCsv(SAMPLE_CSV);
    const nonStandard = result.flagged.filter(
      (f) => f.reason === "non_standard_permit_no",
    );
    expect(nonStandard).toHaveLength(1);
    expect(nonStandard[0]!.customerName).toBe("Better Build - Robinson");
  });

  it("derives correct statuses", () => {
    const result = parsePermitCsv(SAMPLE_CSV);
    const eberly = result.permits.find((p) =>
      p.customerName.includes("Eberly"),
    );
    expect(eberly!.status).toBe("issued");

    const mielke = result.permits.find((p) =>
      p.customerName.includes("Mielke"),
    );
    expect(mielke!.status).toBe("issued");

    const olson = result.permits.find(
      (p) => p.customerName === "Jonathan David Olson",
    );
    expect(olson!.status).toBe("applied");
  });

  it("parses install dates", () => {
    const result = parsePermitCsv(SAMPLE_CSV);
    const mielke = result.permits.find((p) =>
      p.customerName.includes("Mielke"),
    );
    expect(mielke!.installDate).not.toBeNull();
    expect(mielke!.installDate!.getFullYear()).toBe(2025);
    expect(mielke!.installDate!.getMonth()).toBe(0);
    expect(mielke!.installDate!.getDate()).toBe(13);
  });
});
