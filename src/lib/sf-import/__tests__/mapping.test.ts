import { describe, expect, it } from "vitest";

import { addressMatchKey, normalizeStreet, normalizeZip } from "../address";
import { dollarsToCents } from "../money";
import { classifyCustomerRows, parseCustomerLinkCsv } from "../linkCustomers";
import { buildImportPlan } from "../plan";
import { summarizeImport } from "../report";
import { jobScopeDecision, resolveImportOptions } from "../scope";
import { scheduleJob } from "../schedule";
import { mapJobStatus, mapJobType, sfJobNumber } from "../status";
import { matchTechNames } from "../techs";

describe("address normalization", () => {
  it("treats street suffixes, direction words, and zip+4 as the same location", () => {
    expect(normalizeStreet("123 Main Street")).toBe("123 main st");
    expect(normalizeZip("98101-1234")).toBe("98101");
    expect(addressMatchKey("123 Main Street", "98101-1234")).toBe(
      addressMatchKey("123 main st.", "98101"),
    );
    expect(addressMatchKey("456 North Avenue", "98001")).toBe(
      addressMatchKey("456 N Ave", "98001"),
    );
  });

  it("does not use the unit line, and does not match a blank street", () => {
    expect(addressMatchKey("123 Main St", "98101")).toBe("123 main st|98101");
    expect(addressMatchKey("123 Main St Apt 4", "98101")).not.toBe(
      addressMatchKey("123 Main St", "98101"),
    );
    expect(addressMatchKey("", "98101", "Seattle")).toBeNull();
    expect(addressMatchKey("10 Oak Rd", "", "Seattle")).toBe(
      addressMatchKey("10 Oak Road", "", "seattle"),
    );
    expect(addressMatchKey("10 Oak Rd", "", "Tacoma")).not.toBe(
      addressMatchKey("10 Oak Rd", "", "Seattle"),
    );
  });
});

describe("status mapping", () => {
  it("maps Service Fusion statuses and keeps an unknown status out of a guessed closed state", () => {
    expect(mapJobStatus("Paid in Full").status).toBe("Completed");
    expect(mapJobStatus("Invoiced").status).toBe("Completed");
    expect(mapJobStatus("PAST DUE").status).toBe("Completed");
    expect(mapJobStatus("No Charge").status).toBe("Completed");
    expect(mapJobStatus("Warranty").status).toBe("Completed");
    expect(mapJobStatus("Completed").status).toBe("Completed");
    expect(mapJobStatus("Unscheduled").status).toBe("On Hold");
    expect(mapJobStatus("Parts On Order").status).toBe("On Hold");
    expect(mapJobStatus("Scheduled - Service").status).toBe("Scheduled");
    expect(mapJobStatus("Dispatched").status).toBe("Scheduled");
    expect(mapJobStatus("Install").status).toBe("Scheduled");
    expect(mapJobStatus("In Route").status).toBe("In Progress");
    expect(mapJobStatus("Working On Site").status).toBe("In Progress");
    expect(mapJobStatus("Job Cancelled").status).toBe("Cancelled");
    expect(mapJobStatus("Cancelled-Write Off").status).toBe("Cancelled");
    expect(mapJobStatus("Something New").status).toBe("On Hold");
    expect(mapJobStatus("Something New").unknown).toBe(true);
  });

  it("maps job categories, with call backs winning over install", () => {
    expect(mapJobType("Install").type).toBe("Install");
    expect(mapJobType("Service - Maintenance").type).toBe("Maintenance");
    expect(mapJobType("Service - Diagnostic").type).toBe("Service");
    expect(mapJobType("Scheduled Repair").type).toBe("Service");
    expect(mapJobType("Call Back - Install").type).toBe("Callback");
    expect(mapJobType("Call Back - Service").type).toBe("Callback");
    expect(mapJobType("Site Visit").type).toBe("Inspection");
    expect(mapJobType("Inspection Corrections").type).toBe("Inspection");
    expect(mapJobType("Estimate").type).toBe("Estimate");
    expect(mapJobType("Meeting").type).toBe("Service");
    expect(sfJobNumber("1042", "SF-")).toBe("SF-1042");
    expect(sfJobNumber("SF-1042", "SF-")).toBe("SF-1042");
  });
});

describe("technician matching", () => {
  const profiles = [
    { id: "u1", fullName: "Casey Belson" },
    { id: "u2", fullName: "casey belson" },
    { id: "u3", fullName: "Ethan Qualkenbush" },
  ];

  it("matches first and last name without case, and does not guess when two people match", () => {
    const unique = matchTechNames(
      [{ sfId: 1, name: "Ethan Qualkenbush" }, { sfId: 2, name: "Kameron K." }],
      [profiles[0], profiles[2]],
    );
    expect(unique.matched).toEqual([
      {
        sfId: 1,
        userId: "u3",
        fullName: "Ethan Qualkenbush",
        sfName: "Ethan Qualkenbush",
        aliased: false,
      },
    ]);
    expect(unique.unmatched).toEqual([{ name: "Kameron K.", ambiguous: false }]);

    const ambiguous = matchTechNames([{ sfId: 9, name: "Casey Belson" }], profiles);
    expect(ambiguous.matched).toEqual([]);
    expect(ambiguous.unmatched).toEqual([{ name: "Casey Belson", ambiguous: true }]);
  });

  it("uses the saved alias when the Service Fusion name is a short form", () => {
    const result = matchTechNames(
      [
        { sfId: 1, name: "Kameron K." },
        { sfId: 2, name: "Collin Qualkenbush" },
      ],
      [
        { id: "kuhn", fullName: "Kameron Kuhn" },
        { id: "collin", fullName: "Collin" },
        { id: "other", fullName: "Kameron K" },
      ],
    );
    expect(result.matched).toEqual([
      { sfId: 1, userId: "kuhn", fullName: "Kameron Kuhn", sfName: "Kameron K.", aliased: true },
      { sfId: 2, userId: "collin", fullName: "Collin", sfName: "Collin Qualkenbush", aliased: true },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it("treats a trailing initial period as the same name", () => {
    const result = matchTechNames(
      [{ sfId: 4, name: "Kameron K." }],
      [{ id: "u4", fullName: "Kameron K" }],
    );
    expect(result.matched[0]?.userId).toBe("u4");
  });
});

describe("scope filter", () => {
  const options = resolveImportOptions({ asOfDate: "2026-11-01", staleOpenDays: 60 });

  it("keeps recent open jobs and leaves undated or older open jobs behind", () => {
    expect(jobScopeDecision({ status: "Paid in Full", start_date: "2025-01-15" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "No Charge", start_date: "2024-11-01" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "Paid in Full", start_date: "2024-10-31" }, options)).toEqual({
      include: false,
      reason: "out_of_scope_before_cutoff",
    });
    expect(jobScopeDecision({ status: "Unscheduled", start_date: null }, options)).toEqual({
      include: false,
      reason: "undated_open_job",
    });
    expect(jobScopeDecision({ status: "Scheduled - Service", start_date: "2026-10-31" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "Scheduled", start_date: "2026-09-02" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "Scheduled", start_date: "2026-09-01" }, options)).toEqual({
      include: false,
      reason: "stale_open_job",
    });
    expect(jobScopeDecision({ status: "Completed", start_date: "2025-06-01" }, options)).toEqual({
      include: false,
      reason: "stale_open_job",
    });
    expect(jobScopeDecision({ status: "Scheduled", start_date: "2026-11-01" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "Install", start_date: "2026-12-01" }, options).include).toBe(true);
    expect(jobScopeDecision({ status: "Cancelled", start_date: "2023-01-01" }, options)).toEqual({
      include: false,
      reason: "out_of_scope_before_cutoff",
    });
  });
});

describe("money", () => {
  it("rounds dollars to cents", () => {
    expect(dollarsToCents(10.35)).toBe(1035);
    expect(dollarsToCents(36.39636)).toBe(3640);
    expect(dollarsToCents(-300)).toBe(-30000);
    expect(dollarsToCents("1.005")).toBe(101);
    expect(dollarsToCents(null)).toBeNull();
  });
});

describe("import plan", () => {
  it("links a builder parent, prices the job, and skips stale open work", () => {
    const plan = buildImportPlan({
      customers: [
        {
          id: 1,
          customer_name: "Acme Homes",
          contacts: [{ fname: "Pat", lname: "Office", is_primary: true, phones: [], emails: [{ email: "office@acme.test" }] }],
          locations: [{ street_1: "1 Builder Way", city: "Seattle", state_prov: "Washington", postal_code: "98101", is_primary: true }],
        },
        {
          id: 2,
          customer_name: "Lot 10",
          parent_customer: "Acme Homes",
          contacts: [{
            fname: "Ada",
            lname: "Owner",
            is_primary: true,
            phones: [{ phone: "2065550100", type: "Mobile", is_mobile: true }, { phone: "2065550199", type: "Home" }],
            emails: [{ email: "ada@example.test" }],
          }],
          locations: [{
            street_1: "10 Maple Street",
            city: "Seattle",
            state_prov: "WA",
            postal_code: "98101-1234",
            is_primary: true,
            latitude: 47.6,
            longitude: -122.3,
          }],
        },
        {
          id: 3,
          customer_name: "Old Customer",
          contacts: [],
          locations: [],
        },
      ],
      jobs: [
        {
          id: 100,
          number: "5001",
          customer_id: 2,
          customer_name: "Lot 10",
          status: "Paid in Full",
          start_date: "2025-01-15",
          category: "Service - Maintenance",
          priority: "Normal",
          description: "Tune up",
          total: 100.5,
          street_1: "10 Maple St",
          city: "Seattle",
          state_prov: "WA",
          postal_code: "98101",
          time_frame_promised_start: "08:00",
          time_frame_promised_end: "12:00",
          techs_assigned: [
            { id: 11, first_name: "Kameron", last_name: "K." },
            { id: 12, first_name: "Casey", last_name: "Belson" },
          ],
          services: [{ name: "Maintenance", multiplier: 1, rate: 80, total: 80, cost: 10, item_index: 1, tax: "Tax" }],
          products: [],
          other_charges: [{ name: "Tax", rate: 10.35, total: 20.5, charge_index: 1, is_percentage: true, is_discount: false }],
          payments: [{
            payment_transaction_id: 77,
            amount: 100.5,
            type: "Check",
            memo: "paid",
            received_on: "2025-01-20T00:00:00Z",
            invoice_id: 900,
            transaction_token: "secret-token",
          }],
          invoices: [{ id: 900, number: 42, total: 100.5, is_paid: true, date: "2025-01-16T00:00:00Z", terms: "DUR" }],
          notes: [{ notes: "Gate code was used", created_at: "2025-01-15T18:00:00Z" }],
        },
        {
          id: 101,
          number: "1",
          customer_id: 2,
          status: "Unscheduled",
          start_date: null,
          category: "Install",
        },
        {
          id: 102,
          number: "2",
          customer_id: 2,
          status: "Scheduled - Service",
          start_date: "2026-10-01",
          category: "Install",
        },
        {
          id: 104,
          number: "4",
          customer_id: 2,
          status: "Unscheduled",
          start_date: "2026-08-01",
          category: "Install",
        },
        {
          id: 103,
          number: "3",
          customer_id: 2,
          status: "Install",
          start_date: "2026-12-01",
          category: "Install",
          total: -5,
          street_1: "10 Maple Street",
          city: "Seattle",
          postal_code: "98101",
        },
      ],
      estimates: [
        {
          id: 300,
          number: "E-1",
          customer_id: 2,
          created_at: "2025-02-01T00:00:00Z",
          status: "Estimate Provided",
          total: 50,
          street_1: "10 Maple Street",
          city: "Seattle",
          postal_code: "98101",
          products: [{ name: "Furnace", multiplier: 1, rate: 50, total: 50, item_index: 1 }],
        },
        {
          id: 301,
          customer_id: 2,
          created_at: "2020-01-01T00:00:00Z",
          status: "Estimate Won",
        },
      ],
      invoices: [
        { id: 901, number: 43, total: 10, date: "2025-03-01T00:00:00Z", customer: "Lot 10", is_paid: false },
      ],
      equipment: [{
        customerSfId: 2,
        items: [{
          id: 55,
          type: "Gas Furnace",
          make: "Carrier",
          model: "X1",
          serial_number: "SN1",
          location: "Attic",
          notes: "Original",
          custom_fields: [{ name: "Filter Size(s)", value: "16x25" }],
        }],
      }, {
        customerSfId: 3,
        items: [{ id: 99, type: "Coil", make: "Trane" }],
      }],
      calendarTasks: [],
      techs: [{ id: 12, first_name: "Casey", last_name: "Belson" }],
      profiles: [{ id: "user-casey", fullName: "Casey Belson" }],
      options: { asOfDate: "2026-11-01", staleOpenDays: 60 },
    });

    expect(plan.customers.map((customer) => customer.sf_id).sort()).toEqual([1, 2]);
    expect(plan.customerParents).toEqual([{ sf_id: 2, parent_sf_id: 1 }]);
    expect(plan.customers.find((customer) => customer.sf_id === 1)?.state).toBe("WA");
    expect(plan.properties.find((property) => property.customer_sf_id === 1)?.type).toBe("Commercial");
    expect(plan.properties.find((property) => property.customer_sf_id === 2)?.type).toBe("Residential");
    expect(plan.properties.filter((property) => property.customer_sf_id === 2)).toHaveLength(1);

    const priced = plan.jobs.find((job) => job.sf_id === 100);
    expect(priced?.job_number).toBe("SF-5001");
    expect(priced?.type).toBe("Maintenance");
    expect(priced?.status).toBe("Completed");
    expect(priced?.sf_status).toBe("Paid in Full");
    expect(priced?.assigned_user_id).toBe("user-casey");
    expect(priced?.sf_tech_names).toBe("Kameron K.");
    expect(priced?.property_sf_key).toBe(plan.properties.find((property) => property.customer_sf_id === 2)?.sf_key);
    expect(plan.jobFinancials).toEqual([{ job_sf_id: 100, revenue_cents: 10050 }]);
    expect(plan.jobLineItems.map((line) => line.kind)).toEqual(["service", "other_charge"]);
    expect(plan.jobLineItems[1]?.rate_percent).toBe(10.35);
    expect(plan.jobAssignees).toEqual([{ job_sf_id: 100, user_id: "user-casey", sf_tech_id: 12 }]);
    expect(plan.jobNotes[0]?.body).toBe("Gate code was used");
    expect(plan.invoices.map((invoice) => invoice.sf_id).sort()).toEqual([900, 901]);
    expect(plan.payments[0]?.amount_cents).toBe(10050);
    expect(JSON.stringify(plan.payments)).not.toContain("secret-token");
    expect(plan.estimates).toHaveLength(1);
    expect(plan.estimateLineItems).toHaveLength(1);
    expect(plan.installedSystems[0]?.system_name).toBe("Gas Furnace – Carrier");
    expect(plan.installedSystems[0]?.match_state).toBe("unmatched");
    expect(plan.installedSystems[0]?.notes).toContain("Filter Size(s): 16x25");
    expect(plan.jobs.map((job) => job.sf_id).sort()).toEqual([100, 102, 103]);
    expect(plan.jobFinancials.find((row) => row.job_sf_id === 103)).toBeUndefined();
    expect(plan.skips.some((skip) => skip.reason === "undated_open_job" && skip.sfId === "101")).toBe(true);
    expect(plan.skips.some((skip) => skip.reason === "stale_open_job" && skip.sfId === "104")).toBe(true);
    expect(plan.skips.some((skip) => skip.reason === "equipment_customer_out_of_scope" && skip.sfId === "99")).toBe(true);
    expect(plan.unmatchedTechnicians[0]?.name).toBe("Kameron K.");

    const summary = summarizeImport({
      mode: "dry-run",
      options: plan.options,
      plan,
      counts: { customers: { insert: 2, update: 0 }, jobs: { insert: 2, update: 0 } },
      databaseNote: "No database connection.",
    });
    expect(summary).toContain("nothing was written");
    expect(summary).not.toContain("ada@example.test");
    expect(summary).not.toContain("office@acme.test");
    expect(summary).toContain("Kameron K.");
  });
});

describe("parent link left blank", () => {
  it("imports the customer and reports the missing parent as a note", () => {
    const plan = buildImportPlan({
      customers: [{
        id: 8,
        customer_name: "Site",
        parent_customer: "Not In Export",
        contacts: [],
        locations: [],
      }],
      jobs: [{
        id: 80,
        number: "8",
        customer_id: 8,
        status: "Paid in Full",
        start_date: "2025-03-01",
        category: "Install",
      }],
      estimates: [],
      invoices: [],
      equipment: [],
      calendarTasks: [],
      techs: [],
      profiles: [],
      options: { asOfDate: "2026-11-01" },
    });
    expect(plan.customers.map((customer) => customer.sf_id)).toContain(8);
    expect(plan.notices.some((note) => note.sfId === "8" && note.reason === "parent_not_in_export")).toBe(true);
    const summary = summarizeImport({
      mode: "dry-run",
      options: plan.options,
      plan,
      counts: { customers: { insert: 1, update: 0 } },
      databaseNote: "No database connection.",
    });
    expect(summary).toContain("Imported, parent link left blank");
    expect(summary).not.toContain("Not imported: 1\n    Imported, parent link left blank");
  });
});

describe("customer link file", () => {
  it("reads the two id columns and counts a link instead of a new customer", () => {
    const links = parseCustomerLinkCsv("loop_customer_id,sf_customer_id\n11111111-1111-1111-1111-111111111111,2\n");
    expect(links).toEqual([{
      loopCustomerId: "11111111-1111-1111-1111-111111111111",
      sfCustomerId: 2,
    }]);
    const classified = classifyCustomerRows(
      [2, 9],
      links,
      [{ id: "11111111-1111-1111-1111-111111111111", sfId: null }],
    );
    expect(classified.counts).toEqual({ insert: 1, update: 0, link: 1 });
    expect(classified.ready).toEqual(links);

    const summary = summarizeImport({
      mode: "dry-run",
      options: resolveImportOptions({ asOfDate: "2026-11-01" }),
      plan: buildImportPlan({
        customers: [],
        jobs: [],
        estimates: [],
        invoices: [],
        equipment: [],
        calendarTasks: [],
        techs: [],
        profiles: [],
        options: { asOfDate: "2026-11-01" },
      }),
      counts: { customers: classified.counts },
      databaseNote: "No database connection.",
    });
    expect(summary).toContain("Would link: 1");
  });
});

describe("job clock times", () => {
  it("reads a winter morning in Pacific time as UTC", () => {
    const schedule = scheduleJob(
      {
        start_date: "2024-12-02",
        time_frame_promised_start: "08:00",
        time_frame_promised_end: "12:00",
      },
      "America/Los_Angeles",
    );
    expect(schedule.scheduled_start_at).toBe("2024-12-02T16:00:00.000Z");
    expect(schedule.scheduled_end_at).toBe("2024-12-02T20:00:00.000Z");
  });
});
