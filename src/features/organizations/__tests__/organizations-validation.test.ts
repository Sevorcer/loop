import { describe, it, expect } from "vitest";

import {
  CreateOrganizationSchema,
  ListOrganizationsQuerySchema,
  UpdateOrganizationSchema,
} from "@/lib/schemas/organizations";

// ---------------------------------------------------------------------------
// CreateOrganizationSchema
// ---------------------------------------------------------------------------

describe("CreateOrganizationSchema", () => {
  it("accepts a valid name", () => {
    const result = CreateOrganizationSchema.safeParse({ name: "Acme Corp" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Acme Corp");
  });

  it("trims whitespace from name", () => {
    const result = CreateOrganizationSchema.safeParse({ name: "  Trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Trimmed");
  });

  it("rejects missing name", () => {
    const result = CreateOrganizationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("rejects empty string name", () => {
    const result = CreateOrganizationSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("rejects name exceeding 255 characters", () => {
    const result = CreateOrganizationSchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("accepts name at exactly 255 characters", () => {
    const result = CreateOrganizationSchema.safeParse({ name: "a".repeat(255) });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = CreateOrganizationSchema.safeParse({
      name: "Acme Corp",
      spoofed: "x",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateOrganizationSchema
// ---------------------------------------------------------------------------

describe("UpdateOrganizationSchema", () => {
  it("accepts an empty object (no-op patch)", () => {
    const result = UpdateOrganizationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBeUndefined();
  });

  it("accepts a valid name update", () => {
    const result = UpdateOrganizationSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("New Name");
  });

  it("trims whitespace from name", () => {
    const result = UpdateOrganizationSchema.safeParse({ name: "  Padded  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Padded");
  });

  it("rejects empty string name", () => {
    const result = UpdateOrganizationSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("rejects name exceeding 255 characters", () => {
    const result = UpdateOrganizationSchema.safeParse({ name: "b".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = UpdateOrganizationSchema.safeParse({
      name: "Acme Corp",
      created_at: "spoofed",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ListOrganizationsQuerySchema
// ---------------------------------------------------------------------------

describe("ListOrganizationsQuerySchema", () => {
  it("applies defaults when no params provided", () => {
    const result = ListOrganizationsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.search).toBeUndefined();
      expect(result.data.includeDeleted).toBeUndefined();
    }
  });

  it("parses string page and pageSize to numbers", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ page: "3", pageSize: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it("rejects page < 1", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects pageSize > 100", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ pageSize: "101" });
    expect(result.success).toBe(false);
  });

  it("parses includeDeleted=true", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ includeDeleted: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.includeDeleted).toBe(true);
  });

  it("parses includeDeleted=false", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ includeDeleted: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.includeDeleted).toBe(false);
  });

  it("passes through search string", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ search: "acme" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.search).toBe("acme");
  });

  it("rejects unknown query parameters", () => {
    const result = ListOrganizationsQuerySchema.safeParse({ page: "1", badParam: "true" });
    expect(result.success).toBe(false);
  });
});
