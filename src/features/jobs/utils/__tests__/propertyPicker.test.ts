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
    expect(propertyOptionDetail({ address: " ", city: "," })).toBe("");
  });

  it("finds a property by the address shown in the picker", () => {
    const options = [
      { id: "property-1", name: "Northside Plaza", detail: "1450 Northside Blvd, Seattle" },
    ];
    expect(filterRecordOptions(options, "1450").map((option) => option.id)).toEqual(["property-1"]);
    expect(filterRecordOptions(options, "warehouse")).toEqual([]);
  });

  it("treats a name-only inline property draft as complete", () => {
    // Name-only record creation (2026-10-01): the inline property path mirrors
    // the inline customer path, so a street/city are not required here.
    const fields = missingPropertyDraftFields({ name: "Shop", address: " ", city: "" });
    expect(fields).toEqual([]);
    expect(formatMissingPropertyDraft(fields)).toBeNull();
  });

  it("still requires a property name for the inline draft", () => {
    const fields = missingPropertyDraftFields({ name: "  ", address: "1450 Northside Blvd", city: "Seattle" });
    expect(fields).toEqual(["Property name"]);
    expect(formatMissingPropertyDraft(fields)).toBe(
      "Add the missing information: Property name.",
    );
  });
});