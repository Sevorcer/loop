import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the repository layer
// ---------------------------------------------------------------------------

const mockListContacts = vi.fn();
const mockGetContact = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockDeleteContact = vi.fn();

vi.mock("@/repositories/customerContacts", () => ({
  listContactsByCustomerId: (...args: unknown[]) => mockListContacts(...args),
  getContactById: (...args: unknown[]) => mockGetContact(...args),
  createContact: (...args: unknown[]) => mockCreateContact(...args),
  updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  deleteContact: (...args: unknown[]) => mockDeleteContact(...args),
}));

// Suppress "server-only" import error in test
vi.mock("server-only", () => ({}));

import {
  listCustomerContacts,
  getCustomerContact,
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
} from "../customerContacts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = "cust-001";
const CONTACT_ID = "contact-001";

const SAMPLE_CONTACT = {
  id: CONTACT_ID,
  customerId: CUSTOMER_ID,
  name: "Jane Doe",
  role: "super" as const,
  phone: "555-0100",
  email: "jane@example.com",
  isPrimary: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listCustomerContacts", () => {
  it("delegates to repository", async () => {
    mockListContacts.mockResolvedValue([SAMPLE_CONTACT]);
    const result = await listCustomerContacts(CUSTOMER_ID);
    expect(mockListContacts).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual([SAMPLE_CONTACT]);
  });
});

describe("getCustomerContact", () => {
  it("returns the contact when found", async () => {
    mockGetContact.mockResolvedValue(SAMPLE_CONTACT);
    const result = await getCustomerContact(CONTACT_ID);
    expect(result).toEqual(SAMPLE_CONTACT);
  });

  it("returns null when not found", async () => {
    mockGetContact.mockResolvedValue(null);
    const result = await getCustomerContact("missing");
    expect(result).toBeNull();
  });
});

describe("createCustomerContact", () => {
  it("trims input and delegates to repository", async () => {
    mockCreateContact.mockResolvedValue(SAMPLE_CONTACT);

    await createCustomerContact(CUSTOMER_ID, {
      name: "  Jane Doe  ",
      role: "super",
      phone: " 555-0100 ",
      email: " jane@example.com ",
    });

    expect(mockCreateContact).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      name: "Jane Doe",
      role: "super",
      phone: "555-0100",
      email: "jane@example.com",
    });
  });

  it("rejects invalid role", async () => {
    await expect(
      createCustomerContact(CUSTOMER_ID, {
        name: "Jane",
        role: "invalid" as "super",
        phone: "",
        email: "",
      }),
    ).rejects.toThrow(/Invalid contact role/);
  });

  it("rejects when all fields are empty", async () => {
    await expect(
      createCustomerContact(CUSTOMER_ID, {
        name: "",
        role: "other",
        phone: "",
        email: "",
      }),
    ).rejects.toThrow(/At least one/);
  });

  it("accepts valid roles: super, pm, other", async () => {
    mockCreateContact.mockResolvedValue(SAMPLE_CONTACT);

    for (const role of ["super", "pm", "other"] as const) {
      await createCustomerContact(CUSTOMER_ID, {
        name: "Test",
        role,
        phone: "",
        email: "",
      });
    }

    expect(mockCreateContact).toHaveBeenCalledTimes(3);
  });
});

describe("updateCustomerContact", () => {
  it("trims string fields and validates role", async () => {
    mockUpdateContact.mockResolvedValue(SAMPLE_CONTACT);

    await updateCustomerContact(CONTACT_ID, {
      name: "  Updated  ",
      role: "pm",
    });

    expect(mockUpdateContact).toHaveBeenCalledWith(CONTACT_ID, {
      name: "Updated",
      role: "pm",
    });
  });

  it("rejects invalid role on update", async () => {
    await expect(
      updateCustomerContact(CONTACT_ID, {
        role: "bad" as "super",
      }),
    ).rejects.toThrow(/Invalid contact role/);
  });
});

describe("deleteCustomerContact", () => {
  it("delegates to repository and returns boolean", async () => {
    mockDeleteContact.mockResolvedValue(true);
    const result = await deleteCustomerContact(CONTACT_ID);
    expect(result).toBe(true);
    expect(mockDeleteContact).toHaveBeenCalledWith(CONTACT_ID);
  });
});
