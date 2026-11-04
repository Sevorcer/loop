/**
 * GC Portal — Money Toggle Tests (Task 3)
 *
 * Tests:
 * - Toggle off → no money fields in portal response
 * - Toggle on → money fields match ledger
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveShareTokenMock,
  getPortalJobDataMock,
} = vi.hoisted(() => ({
  resolveShareTokenMock: vi.fn(),
  getPortalJobDataMock: vi.fn(),
}));

vi.mock("@/services/jobShareLinks", () => ({
  resolveShareToken: resolveShareTokenMock,
}));

vi.mock("@/services/portalJobData", () => ({
  getPortalJobData: getPortalJobDataMock,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = "c".repeat(64);
const JOB_ID = "job-money-001";
const ORG_ID = "org-001";

const JOB_DATA_NO_MONEY = {
  id: JOB_ID,
  jobNumber: "J-200",
  status: "In Progress",
  type: "Install",
  scheduledDate: "2026-11-10",
  completedDate: null,
  propertyAddress: "456 Oak St",
  customerName: "Builder Co",
  crewFirstNames: ["Mike"],
  timeline: [],
  photos: [],
  documents: [],
};

const JOB_DATA_WITH_MONEY = {
  ...JOB_DATA_NO_MONEY,
  money: {
    priceCents: 850000,
    changeOrders: [{ id: "co-1", changeOrderNumber: "CO-001", amountCents: 25000, description: "Extra ductwork" }],
    invoiceNumber: "INV-2026-0042",
    dateSent: "2026-10-15",
    dateReceived: null,
    balanceCents: 425000,
    retainerCents: 50000,
  },
};

function mockRequest(url: string) {
  return new Request(url, { method: "GET" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Portal money visibility toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggle off → no money fields in portal response", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_ID });
    getPortalJobDataMock.mockResolvedValue(JOB_DATA_NO_MONEY);

    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(
      mockRequest(`http://localhost/api/portal/${VALID_TOKEN}`),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.money).toBeUndefined();
  });

  it("toggle on → money fields present and match ledger", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_ID });
    getPortalJobDataMock.mockResolvedValue(JOB_DATA_WITH_MONEY);

    const { GET } = await import("@/app/api/portal/[token]/route");
    const res = await GET(
      mockRequest(`http://localhost/api/portal/${VALID_TOKEN}`),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.money).toBeDefined();
    expect(body.job.money.priceCents).toBe(850000);
    expect(body.job.money.balanceCents).toBe(425000);
    expect(body.job.money.retainerCents).toBe(50000);
    expect(body.job.money.invoiceNumber).toBe("INV-2026-0042");
    expect(body.job.money.changeOrders).toHaveLength(1);
    expect(body.job.money.changeOrders[0].amountCents).toBe(25000);
  });
});
