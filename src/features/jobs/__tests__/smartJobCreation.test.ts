import { describe, expect, it } from "vitest";

import {
  applyCustomerAutocomplete,
  applyPropertyAutocomplete,
  buildTechnicianSuggestions,
  getScopedProperties,
  resolveInitialSmartSelection,
} from "../utils/smartJobCreation";

const customers = [
  {
    id: "customer-1",
    name: "Northside Retail Group",
    primaryContact: "Nina",
    phone: "555-0101",
    email: "nina@example.com",
  },
  {
    id: "customer-2",
    name: "Summit Storage",
    primaryContact: "Sam",
    phone: "555-0102",
    email: "sam@example.com",
  },
];

const properties = [
  {
    id: "property-1",
    name: "Northside Plaza",
    customer: "Northside Retail Group",
    customerId: "customer-1",
    address: "1450 Northside Blvd",
    city: "Seattle",
  },
  {
    id: "property-2",
    name: "Summit Storage West",
    customer: "Summit Storage",
    customerId: "customer-2",
    address: "2400 Summit Park Road",
    city: "Bellevue",
  },
];

describe("smartJobCreation integration", () => {
  it("pre-binds customer/property/location from property context", () => {
    const result = resolveInitialSmartSelection(customers, properties, {
      propertyId: "property-1",
    });

    expect(result.state.customerId).toBe("customer-1");
    expect(result.state.propertyId).toBe("property-1");
    expect(result.formPatch.customerName).toBe("Northside Retail Group");
    expect(result.formPatch.propertyName).toBe("Northside Plaza");
    expect(result.formPatch.location).toContain("1450 Northside Blvd");
  });

  it("scopes property options to selected customer", () => {
    const scoped = getScopedProperties(properties, "customer-2");
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.name).toBe("Summit Storage West");
  });

  it("prefills customer and location when a property is selected", () => {
    const result = applyPropertyAutocomplete(properties, "Northside Plaza");
    expect(result.state.customerId).toBe("customer-1");
    expect(result.state.propertyId).toBe("property-1");
    expect(result.formPatch.customerName).toBe("Northside Retail Group");
    expect(result.formPatch.location).toContain("Seattle");
  });

  it("retains freeform entry when customer is not an exact match", () => {
    const result = applyCustomerAutocomplete(customers, "Custom Walk-in");
    expect(result.state.customerId).toBeUndefined();
    expect(result.formPatch.customerName).toBe("Custom Walk-in");
  });
});

// The assignee picker only sources active org members now, but the form keeps
// a free-text fallback (built from crew + existing-job names) so an imported
// Service Fusion crew with no LOOP account is still shown and its historical
// assignment is never dropped — PR #300's display-only fallback. This locks
// that fallback source so it keeps surfacing those SF names.
describe("buildTechnicianSuggestions (SF-name display fallback source)", () => {
  it("surfaces imported crew names, de-duplicated and sorted", () => {
    const suggestions = buildTechnicianSuggestions([
      "Sebastian Vasquez",
      "Antonio Vilchez",
      "Sebastian Vasquez",
      "",
      "  ",
    ]);
    expect(suggestions).toEqual(["Antonio Vilchez", "Sebastian Vasquez"]);
  });

  it("preserves a historical free-text assignment with no matching profile", () => {
    const suggestions = buildTechnicianSuggestions(["Marcus Rivera"]);
    expect(suggestions).toContain("Marcus Rivera");
  });
});
