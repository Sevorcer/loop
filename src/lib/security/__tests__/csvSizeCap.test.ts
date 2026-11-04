/**
 * Test that the CSV import route rejects oversized files with 413.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/api-auth", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    ok: true,
    response: null,
    ctx: { userId: "test-user", role: "owner", orgId: "org-1" },
  }),
}));

vi.mock("@/services/customers", () => ({ createCustomer: vi.fn() }));
vi.mock("@/services/properties", () => ({ createProperty: vi.fn() }));
vi.mock("@/services/jobs", () => ({ createJob: vi.fn() }));

import { POST } from "@/app/api/import/[entity]/route";

function buildFormDataRequest(fileSizeBytes: number, entity = "customers"): Request {
  const header = "name,email,phone,city,status,primaryContact\n";
  const rowTemplate = "Acme Inc,test@example.com,555-1234,Seattle,active,John\n";
  const rowCount = Math.ceil((fileSizeBytes - header.length) / rowTemplate.length);
  const csvContent = header + rowTemplate.repeat(rowCount);
  const finalContent = csvContent.slice(0, fileSizeBytes);

  const file = new File([finalContent], "import.csv", { type: "text/csv" });
  const formData = new FormData();
  formData.append("file", file);

  return new Request(`https://loop.example/api/import/${entity}?mode=dry_run`, {
    method: "POST",
    body: formData,
  });
}

describe("CSV import size cap", () => {
  it("rejects files larger than 10 MB with 413", async () => {
    const oversize = 10 * 1024 * 1024 + 1;
    const request = buildFormDataRequest(oversize);
    const params = Promise.resolve({ entity: "customers" });

    const response = await POST(request, { params });
    expect(response.status).toBe(413);

    const body = await response.json();
    expect(body.error).toBe("PAYLOAD_TOO_LARGE");
  });

  it("allows files at or under 10 MB", async () => {
    const request = buildFormDataRequest(500);
    const params = Promise.resolve({ entity: "customers" });

    const response = await POST(request, { params });
    expect(response.status).not.toBe(413);
  });
});
