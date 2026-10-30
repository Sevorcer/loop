import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  linkedPropertyIdsByCustomer,
  resolvePropertyCustomer,
  UNLINKED_CUSTOMER_LABEL,
} from "../propertyCustomerLink";

describe("property customer linking", () => {
  const customers = [
    { id: "cust-1", name: "Northwind HVAC" },
    { id: "cust-2", name: "Harbor View" },
  ];

  it("keeps a stored customer id", () => {
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-1",
        propertyName: "Shop",
        customerId: "cust-1",
        customers,
        jobHints: [],
      }),
    ).toEqual({ customerId: "cust-1", customerName: "Northwind HVAC" });
  });

  it("fills a missing customer from the one job that points at the property", () => {
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-1",
        propertyName: "Shop",
        customerId: null,
        customers,
        jobHints: [
          {
            propertyId: "prop-1",
            propertyName: "Shop",
            customerId: "cust-2",
            customerName: "Harbor View",
          },
        ],
      }),
    ).toEqual({ customerId: "cust-2", customerName: "Harbor View" });
  });

  it("does not guess when jobs disagree", () => {
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-1",
        propertyName: "Shop",
        customerId: null,
        customers,
        jobHints: [
          {
            propertyId: "prop-1",
            propertyName: "Shop",
            customerId: "cust-1",
            customerName: "Northwind HVAC",
          },
          {
            propertyId: "prop-1",
            propertyName: "Shop",
            customerId: "cust-2",
            customerName: "Harbor View",
          },
        ],
      }).customerName,
    ).toBe(UNLINKED_CUSTOMER_LABEL);
  });

  it("matches a customer by the name stored on the job", () => {
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-1",
        propertyName: "Shop",
        customerId: null,
        customers,
        jobHints: [
          {
            propertyId: null,
            propertyName: "shop",
            customerId: null,
            customerName: "northwind hvac",
          },
        ],
      }),
    ).toEqual({ customerId: "cust-1", customerName: "Northwind HVAC" });
  });
});

describe("linked property counts", () => {
  const customers = [
    { id: "cust-1", name: "Northwind HVAC" },
    { id: "cust-2", name: "Harbor View" },
  ];

  it("counts a property saved on the customer and one linked only by a job", () => {
    const linked = linkedPropertyIdsByCustomer({
      properties: [
        { id: "prop-direct", name: "Shop", customerId: "cust-1" },
        { id: "prop-job", name: "Warehouse", customerId: null },
      ],
      customers,
      jobHints: [
        {
          propertyId: "prop-job",
          propertyName: "Warehouse",
          customerId: "cust-1",
          customerName: "Northwind HVAC",
        },
      ],
    });

    expect(linked.get("cust-1")?.sort()).toEqual(["prop-direct", "prop-job"]);
    expect(linked.get("cust-2")).toBeUndefined();
  });

  it("does not count a property whose jobs disagree, including a generic Commercial name", () => {
    const linked = linkedPropertyIdsByCustomer({
      properties: [
        { id: "prop-commercial", name: "Commercial", customerId: null },
      ],
      customers,
      jobHints: [
        {
          propertyId: "prop-commercial",
          propertyName: "Commercial",
          customerId: "cust-1",
          customerName: "Northwind HVAC",
        },
        {
          propertyId: "prop-commercial",
          propertyName: "Commercial",
          customerId: "cust-2",
          customerName: "Harbor View",
        },
      ],
    });

    expect(linked.size).toBe(0);
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-commercial",
        propertyName: "Commercial",
        customerId: null,
        customers,
        jobHints: [
          {
            propertyId: "prop-commercial",
            propertyName: "Commercial",
            customerId: "cust-1",
            customerName: "Northwind HVAC",
          },
          {
            propertyId: "prop-commercial",
            propertyName: "Commercial",
            customerId: "cust-2",
            customerName: "Harbor View",
          },
        ],
      }).customerName,
    ).toBe(UNLINKED_CUSTOMER_LABEL);
  });

  it("leaves a property unlinked when nothing points at it", () => {
    expect(
      resolvePropertyCustomer({
        propertyId: "prop-commercial",
        propertyName: "Commercial",
        customerId: null,
        customers,
        jobHints: [],
      }).customerName,
    ).toBe(UNLINKED_CUSTOMER_LABEL);
  });
});

describe("property customer backfill migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20261029000001_backfill_property_customer_links.sql"),
    "utf8",
  );

  it("only fills null customer ids and does not delete rows", () => {
    expect(sql.toLowerCase()).not.toContain("delete ");
    expect(sql).toContain("p.customer_id IS NULL");
    expect(sql).toMatch(/--\s*DOWN/);
    expect(sql).not.toMatch(/SET\s+customer_id\s*=\s*NULL/i);
  });
});
