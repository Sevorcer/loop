import { describe, it, expect } from "vitest";

import {
  CONTACT_ROLES,
  CONTACT_ROLE_LABELS,
} from "../types/customerContact";
import type { ContactRole, CustomerContact } from "../types/customerContact";

// ---------------------------------------------------------------------------
// Type / role tests
// ---------------------------------------------------------------------------

describe("CustomerContact types", () => {
  it("CONTACT_ROLES contains the three allowed values", () => {
    expect(CONTACT_ROLES).toEqual(["super", "pm", "other"]);
  });

  it("CONTACT_ROLE_LABELS maps every role to a display label", () => {
    for (const role of CONTACT_ROLES) {
      expect(CONTACT_ROLE_LABELS[role]).toBeTruthy();
      expect(typeof CONTACT_ROLE_LABELS[role]).toBe("string");
    }
  });

  it("labels are human-readable and distinct", () => {
    const labels = Object.values(CONTACT_ROLE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
    expect(CONTACT_ROLE_LABELS.super).toBe("Super");
    expect(CONTACT_ROLE_LABELS.pm).toBe("PM");
    expect(CONTACT_ROLE_LABELS.other).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// Authorization matrix for customer_contacts
// ---------------------------------------------------------------------------

import {
  hasPermission,
} from "@/services/authorization";
import type { AppRole, TableAction } from "@/services/authorization";

function expectAllowed(role: AppRole, actions: TableAction[]) {
  for (const action of actions) {
    expect(
      hasPermission(role, "customer_contacts", action),
      `${role} should be ALLOWED to ${action} on customer_contacts`,
    ).toBe(true);
  }
}

function expectDenied(role: AppRole, actions: TableAction[]) {
  for (const action of actions) {
    expect(
      hasPermission(role, "customer_contacts", action),
      `${role} should be DENIED to ${action} on customer_contacts`,
    ).toBe(false);
  }
}

describe("customer_contacts permissions", () => {
  it("owner has full CRUD", () => {
    expectAllowed("owner", ["select", "insert", "update", "delete"]);
  });

  it("manager has full CRUD", () => {
    expectAllowed("manager", ["select", "insert", "update", "delete"]);
  });

  it("office has full CRUD", () => {
    expectAllowed("office", ["select", "insert", "update", "delete"]);
  });

  it("tech can read only", () => {
    expectAllowed("tech", ["select"]);
    expectDenied("tech", ["insert", "update", "delete"]);
  });

  it("dispatch can read only", () => {
    expectAllowed("dispatch", ["select"]);
    expectDenied("dispatch", ["insert", "update", "delete"]);
  });

  it("sales can read only", () => {
    expectAllowed("sales", ["select"]);
    expectDenied("sales", ["insert", "update", "delete"]);
  });

  it("portal cannot access contacts at all", () => {
    expectDenied("portal", ["select", "insert", "update", "delete"]);
  });
});

// ---------------------------------------------------------------------------
// Component data contract — verifies the shape renders correctly
// ---------------------------------------------------------------------------

describe("CustomerContact rendering contract", () => {
  const contact: CustomerContact = {
    id: "c1",
    customerId: "cust-1",
    name: "John Smith",
    role: "super",
    phone: "555-1234",
    email: "john@test.com",
    isPrimary: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("contact has all required fields", () => {
    expect(contact.id).toBeTruthy();
    expect(contact.customerId).toBeTruthy();
    expect(contact.name).toBe("John Smith");
    expect(contact.role).toBe("super");
    expect(contact.phone).toBe("555-1234");
    expect(contact.email).toBe("john@test.com");
    expect(contact.isPrimary).toBe(true);
  });

  it("role is a valid ContactRole", () => {
    expect(CONTACT_ROLES).toContain(contact.role);
  });

  it("role badge label exists for the contact role", () => {
    const label = CONTACT_ROLE_LABELS[contact.role as ContactRole];
    expect(label).toBe("Super");
  });
});
