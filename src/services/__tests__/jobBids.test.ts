/**
 * Money Layer — Job bid service tests.
 *
 * Covers: CRUD, status validation, amount validation, and history
 * preservation (old bid becomes non-current when a new one is created).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  listBidsByJobIdMock,
  getBidByIdMock,
  createBidMock,
  updateBidMock,
  deleteBidMock,
  markBidsNonCurrentMock,
} = vi.hoisted(() => ({
  listBidsByJobIdMock: vi.fn(),
  getBidByIdMock: vi.fn(),
  createBidMock: vi.fn(),
  updateBidMock: vi.fn(),
  deleteBidMock: vi.fn(),
  markBidsNonCurrentMock: vi.fn(),
}));

vi.mock("@/repositories/jobBids", () => ({
  listBidsByJobId: listBidsByJobIdMock,
  getBidById: getBidByIdMock,
  createBid: createBidMock,
  updateBid: updateBidMock,
  deleteBid: deleteBidMock,
  markBidsNonCurrent: markBidsNonCurrentMock,
}));

// Must import after mocks are set up.
const { listJobBids, createJobBid, updateJobBid, deleteJobBid } = await import("@/services/jobBids");

const JOB_ID = "job-001";

function makeBid(overrides: Partial<{
  id: string;
  amountCents: number;
  status: string;
  isCurrent: boolean;
  createdAt: string;
}> = {}) {
  return {
    id: overrides.id ?? "bid-001",
    orgId: "org-001",
    jobId: JOB_ID,
    amountCents: overrides.amountCents ?? 150000,
    status: overrides.status ?? "draft",
    fileId: null,
    isCurrent: overrides.isCurrent ?? true,
    notes: "",
    createdAt: overrides.createdAt ?? "2026-11-15T10:00:00Z",
    updatedAt: "2026-11-15T10:00:00Z",
    createdBy: null,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  markBidsNonCurrentMock.mockResolvedValue(undefined);
});

// ── CRUD ──────────────────────────────────────────────────────────────────

describe("listJobBids", () => {
  it("returns bids from the repository", async () => {
    const bids = [makeBid({ id: "bid-1" }), makeBid({ id: "bid-2", isCurrent: false })];
    listBidsByJobIdMock.mockResolvedValue(bids);

    const result = await listJobBids(JOB_ID);
    expect(result).toEqual(bids);
    expect(listBidsByJobIdMock).toHaveBeenCalledWith(JOB_ID);
  });
});

describe("createJobBid", () => {
  it("creates a bid with valid input", async () => {
    const created = makeBid();
    createBidMock.mockResolvedValue(created);

    const result = await createJobBid({
      jobId: JOB_ID,
      amountCents: 150000,
      status: "draft",
    });

    expect(result).toEqual(created);
    expect(createBidMock).toHaveBeenCalledWith(expect.objectContaining({
      jobId: JOB_ID,
      amountCents: 150000,
      status: "draft",
    }));
  });

  it("marks previous bids as non-current before creating", async () => {
    createBidMock.mockResolvedValue(makeBid());

    await createJobBid({
      jobId: JOB_ID,
      amountCents: 200000,
      status: "sent",
    });

    expect(markBidsNonCurrentMock).toHaveBeenCalledWith(JOB_ID);
    expect(markBidsNonCurrentMock).toHaveBeenCalledBefore(createBidMock);
  });
});

describe("updateJobBid", () => {
  it("updates a bid", async () => {
    const updated = makeBid({ amountCents: 175000 });
    updateBidMock.mockResolvedValue(updated);

    const result = await updateJobBid("bid-001", { amountCents: 175000 });
    expect(result).toEqual(updated);
  });
});

describe("deleteJobBid", () => {
  it("deletes a bid", async () => {
    deleteBidMock.mockResolvedValue(true);

    const result = await deleteJobBid("bid-001");
    expect(result).toBe(true);
  });
});

// ── Validation ────────────────────────────────────────────────────────────

describe("amount validation", () => {
  it("rejects zero amount", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: 0, status: "draft" }),
    ).rejects.toThrow("greater than zero");
  });

  it("rejects negative amount", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: -100, status: "draft" }),
    ).rejects.toThrow("greater than zero");
  });

  it("rejects NaN amount", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: NaN, status: "draft" }),
    ).rejects.toThrow("greater than zero");
  });

  it("rejects Infinity", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: Infinity, status: "draft" }),
    ).rejects.toThrow("greater than zero");
  });

  it("rejects unsafe integer", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: Number.MAX_SAFE_INTEGER + 1, status: "draft" }),
    ).rejects.toThrow("out of range");
  });
});

describe("status validation", () => {
  it("rejects invalid status on create", async () => {
    await expect(
      createJobBid({ jobId: JOB_ID, amountCents: 100, status: "invalid" }),
    ).rejects.toThrow("Invalid bid status");
  });

  it("rejects invalid status on update", async () => {
    await expect(
      updateJobBid("bid-001", { status: "bogus" }),
    ).rejects.toThrow("Invalid bid status");
  });

  it.each(["draft", "sent", "accepted", "declined"] as const)(
    "accepts valid status: %s",
    async (validStatus) => {
      createBidMock.mockResolvedValue(makeBid({ status: validStatus }));
      const result = await createJobBid({ jobId: JOB_ID, amountCents: 100, status: validStatus });
      expect(result.status).toBe(validStatus);
    },
  );
});

// ── History preservation ──────────────────────────────────────────────────

describe("bid history", () => {
  it("old bid becomes non-current when new bid is created", async () => {
    const oldBid = makeBid({ id: "bid-old", isCurrent: true, createdAt: "2026-11-10T10:00:00Z" });
    const newBid = makeBid({ id: "bid-new", isCurrent: true, createdAt: "2026-11-15T10:00:00Z" });

    createBidMock.mockResolvedValue(newBid);

    await createJobBid({
      jobId: JOB_ID,
      amountCents: 200000,
      status: "sent",
    });

    // markBidsNonCurrent should have been called with the job ID
    expect(markBidsNonCurrentMock).toHaveBeenCalledWith(JOB_ID);
  });

  it("bid history ordering: newest first", async () => {
    const bids = [
      makeBid({ id: "bid-3", createdAt: "2026-11-15T10:00:00Z", isCurrent: true }),
      makeBid({ id: "bid-2", createdAt: "2026-11-12T10:00:00Z", isCurrent: false }),
      makeBid({ id: "bid-1", createdAt: "2026-11-10T10:00:00Z", isCurrent: false }),
    ];
    listBidsByJobIdMock.mockResolvedValue(bids);

    const result = await listJobBids(JOB_ID);
    expect(result[0].id).toBe("bid-3");
    expect(result[1].id).toBe("bid-2");
    expect(result[2].id).toBe("bid-1");
    // The current bid is the newest
    expect(result[0].isCurrent).toBe(true);
    expect(result[1].isCurrent).toBe(false);
    expect(result[2].isCurrent).toBe(false);
  });
});
