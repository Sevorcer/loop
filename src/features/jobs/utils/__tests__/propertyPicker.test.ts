import { describe, expect, it } from "vitest";

import {
  filterRecordOptions,
  formatMissingPropertyDraft,
  missingPropertyDraftFields,
  propertiesForCustomer,
  propertiesMatchingQuery,
  propertyOptionDetail,
} from "../propertyPicker";

const properties = [
  {
    id: "property-1",
    name: "Northside Plaza",
    customerId: "customer-1",
    address: "1450 Northside Blvd",
    city: "Seattle",
  },
  {
    id: "property-2",
    name: "Summit Storage West",
    customerId: "customer-2",
    address: "2400 Summit Park Road",
    city: "Bellevue",
  },
];

describe("property picker", () => {
  it("offers only the selected customer's properties", () => {
    expect(propertiesForCustomer(properties, "customer-1").map((property) => property.id)).toEqual([
      "property-1",
    ]);
    expect(propertiesForCustomer(properties, undefined)).toEqual([]);
  });

  it("matches a search against the street address", () => {
    expect(propertiesMatchingQuery(properties, "summit park").map((property) => property.id)).toEqual([
      "property-2",
    ]);
    expect(propertiesMatchingQuery(properties, "seattle").map((property) => property.name)).toEqual([
      "Northside Plaza",
    ]);
  });

  it("shows the address under the property name", () => {
    expect(propertyOptionDetail(properties[0])).toBe("1450 Northside Blvd, Seattle");
    expect(propertyOptionDetail({ address: "", city: "Salem" })).toBe("Salem");
  });

  it("finds a property by the address shown in the picker", () => {
    const options = [
      { id: "property-1", name: "Northside Plaza", detail: "1450 Northside Blvd, Seattle" },
    ];
    expect(filterRecordOptions(options, "1450").map((option) => option.id)).toEqual(["property-1"]);
    expect(filterRecordOptions(options, "warehouse")).toEqual([]);
  });

  it("names the missing address fields", () => {
    const fields = missingPropertyDraftFields({ name: "Shop", address: " ", city: "" });
    expect(fields).toEqual(["Street address", "City"]);
    expect(formatMissingPropertyDraft(fields)).toBe(
      "Add the missing information: Street address, City.",
    );
  });
});