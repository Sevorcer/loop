import { describe, it, expect } from "vitest";

import type { Contractor } from "../types/contractor";
import {
  validateCreateContractorInput,
  buildContractor,
} from "../utils/contractorUtils";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const existingContractors: Contractor[] = [
  {
    id: "c-001",
    companyName: "Arctic Air Solutions",
    contactName: "James Herrera",
    email: "james@arcticair.com",
    phone: "206-555-0101",
    trade: "HVAC",
    active: true,
    createdAt: "2026-01-15T09:00:00.000Z",
  },
];

const validInput = {
  companyName: "Volt Masters Electric",
  contactName: "Sandra Kim",
  email: "sandra@voltmasters.com",
  phone: "206-555-0202",
  trade: "Electrical" as const,
};

// ─── validateCreateContractorInput ────────────────────────────────────────────

describe("validateCreateContractorInput", () => {
  it("returns valid for a correct new contractor", () => {
    const result = validateCreateContractorInput(existingContractors, validInput);
    expect(result.valid).toBe(true);
  });

  it("returns error when companyName is empty", () => {
    const result = validateCreateContractorInput(existingContractors, {
      ...validInput,
      companyName: "  ",
    });
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/company name/i);
  });

  it("returns error when contactName is empty", () => {
    const result = validateCreateContractorInput(existingContractors, {
      ...validInput,
      contactName: "",
    });
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/contact name/i);
  });

  it("returns error when email is empty", () => {
    const result = validateCreateContractorInput(existingContractors, {
      ...validInput,
      email: "",
    });
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/email/i);
  });

  it("returns error when email format is invalid", () => {
    const result = validateCreateContractorInput(existingContractors, {
      ...validInput,
      email: "not-an-email",
    });
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/email/i);
  });

  it("returns duplicate error when email already exists (case-insensitive)", () => {
    const result = validateCreateContractorInput(existingContractors, {
      ...validInput,
      email: "JAMES@ARCTICAIR.COM",
    });
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/already exists/i);
  });
});

// ─── buildContractor ──────────────────────────────────────────────────────────

describe("buildContractor", () => {
  it("builds a contractor with active: true and lowercased email", () => {
    const contractor = buildContractor(
      { ...validInput, email: "Sandra@VoltMasters.COM" },
      "new-id"
    );
    expect(contractor.id).toBe("new-id");
    expect(contractor.email).toBe("sandra@voltmasters.com");
    expect(contractor.active).toBe(true);
    expect(contractor.companyName).toBe("Volt Masters Electric");
  });

  it("trims whitespace from string fields", () => {
    const contractor = buildContractor(
      { ...validInput, companyName: "  My Company  ", contactName: " John  " },
      "id-2"
    );
    expect(contractor.companyName).toBe("My Company");
    expect(contractor.contactName).toBe("John");
  });
});
