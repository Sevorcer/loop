/**
 * Monotonic job-number allocation: jobs repository (review item B11).
 *
 * getMaxJobNumberSuffix must return the TRUE MAX numeric suffix among existing
 * JOB-<n> rows — never the newest row by created_at. The newest-by-created_at
 * approach reused numbers after a deletion: deleting the highest-numbered jobs
 * (JOB-1018/JOB-1019, 2026-11-02) left the newest *remaining* row with a lower
 * number, so the next create reissued a number that had already existed.
 *
 * These tests prove:
 *   - max wins over newest-by-created_at,
 *   - a gap left by a deleted/lower-numbered row is NOT reused (max still wins),
 *   - cancelled and soft-deleted (deleted_at) rows are COUNTED — their numbers
 *     are never reissued (the query must not filter them out),
 *   - SF-<n> import numbers do not disturb the JOB- sequence.
 *
 * The fake Supabase records the query it was handed so the test can prove the
 * read does not order by created_at or cap with a limit (which is what made the
 * old query return the wrong row).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const { makeSupabase, lastQuery } = vi.hoisted(() => {
  const lastQuery: { ordered: boolean; limited: boolean; likePattern: string | null } = {
    ordered: false,
    limited: false,
    likePattern: null,
  };

  class FakeQuery {
    private likePattern: string | null = null;

    constructor(private readonly rows: Row[]) {}

    select(_columns: string) {
      return this;
    }

    eq() {
      return this;
    }

    like(_column: string, pattern: string) {
      this.likePattern = pattern;
      lastQuery.likePattern = pattern;
      return this;
    }

    order() {
      lastQuery.ordered = true;
      return this;
    }

    limit() {
      lastQuery.limited = true;
      return this;
    }

    private execute() {
      let rows = [...this.rows];
      if (this.likePattern) {
        const prefix = this.likePattern.replace(/%$/, "");
        rows = rows.filter((row) => String(row.job_number ?? "").startsWith(prefix));
      }
      return { data: rows, error: null as null };
    }

    then<T1, T2>(
      onFulfilled?: ((value: { data: Row[]; error: null }) => T1) | null,
      onRejected?: ((reason: unknown) => T2) | null,
    ) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
  }

  function makeSupabase(rows: Row[]) {
    return {
      from(table: string) {
        return new FakeQuery(table === "jobs" ? rows : []);
      },
    };
  }

  return { makeSupabase, lastQuery };
});

const { getRepositoryContextMock } = vi.hoisted(() => ({
  getRepositoryContextMock: vi.fn(),
}));

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: getRepositoryContextMock,
}));

import { getMaxJobNumberSuffix, isJobNumberUniqueViolation } from "@/repositories/jobs";

function useRows(rows: Row[]) {
  getRepositoryContextMock.mockResolvedValue({
    supabase: makeSupabase(rows),
    orgId: "org-test",
  });
}

describe("getMaxJobNumberSuffix", () => {
  it("returns the MAX suffix, not the newest row by created_at", async () => {
    // Newest-by-created_at is JOB-1005 (created last) but the MAX is JOB-1019.
    useRows([
      { job_number: "JOB-1019", created_at: "2026-01-01T00:00:00.000Z" },
      { job_number: "JOB-1018", created_at: "2026-01-02T00:00:00.000Z" },
      { job_number: "JOB-1005", created_at: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(await getMaxJobNumberSuffix()).toBe(1019);
  });

  it("does NOT reuse a gap left by a deleted higher-numbered row — max still wins", async () => {
    // Simulates the incident: a lower row was created most recently after the
    // top numbers were (hard) deleted. Newest-by-created_at would return 1017
    // (→ reuse 1018); max returns 1019.
    useRows([
      { job_number: "JOB-1017", created_at: "2026-11-02T10:00:00.000Z" },
      { job_number: "JOB-1019", created_at: "2026-11-02T08:00:00.000Z" },
      { job_number: "JOB-1012", created_at: "2026-11-02T09:00:00.000Z" },
    ]);
    const suffix = await getMaxJobNumberSuffix();
    expect(suffix).toBe(1019);
    expect(suffix + 1).toBe(1020); // next number, not the reused 1018
  });

  it("counts cancelled and soft-deleted rows so their numbers are never reissued", async () => {
    // JOB-1020 is cancelled, JOB-1021 is soft-deleted (deleted_at set). The
    // query must still see them: max = 1021.
    useRows([
      { job_number: "JOB-1018", status: "Scheduled", deleted_at: null },
      { job_number: "JOB-1020", status: "Cancelled", deleted_at: null },
      { job_number: "JOB-1021", status: "Completed", deleted_at: "2026-11-02T12:00:00.000Z" },
    ]);
    expect(await getMaxJobNumberSuffix()).toBe(1021);
  });

  it("ignores SF-<n> import numbers — they do not disturb the JOB- sequence", async () => {
    useRows([
      { job_number: "JOB-1003" },
      { job_number: "SF-99999" },
      { job_number: "SF-4" },
    ]);
    const suffix = await getMaxJobNumberSuffix();
    expect(suffix).toBe(1003);
    // Proves the read restricts to JOB-% (SF rows filtered server-side).
    expect(lastQuery.likePattern).toBe("JOB-%");
  });

  it("returns 0 for an org with no JOB-<n> rows (first job becomes JOB-1001)", async () => {
    useRows([]);
    expect(await getMaxJobNumberSuffix()).toBe(0);
  });

  it("reads MAX without ordering by created_at or capping with limit", async () => {
    lastQuery.ordered = false;
    lastQuery.limited = false;
    useRows([{ job_number: "JOB-1001" }]);
    await getMaxJobNumberSuffix();
    // The old bug was `.order("created_at", desc).limit(1)` — a true max scan
    // must do neither.
    expect(lastQuery.ordered).toBe(false);
    expect(lastQuery.limited).toBe(false);
  });

  it("computes a numeric max (JOB-10000 > JOB-9999), not a lexical one", async () => {
    useRows([{ job_number: "JOB-9999" }, { job_number: "JOB-10000" }]);
    expect(await getMaxJobNumberSuffix()).toBe(10000);
  });
});

describe("isJobNumberUniqueViolation", () => {
  it("matches a 23505 on the job_number index", () => {
    expect(
      isJobNumberUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "jobs_job_number_unique"',
      }),
    ).toBe(true);
  });

  it("matches a duplicate-key message that mentions job_number without a code", () => {
    expect(
      isJobNumberUniqueViolation({ message: "duplicate key value for job_number" }),
    ).toBe(true);
  });

  it("does NOT match a unique violation on a different constraint", () => {
    expect(
      isJobNumberUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "jobs_estimate_id_key"',
      }),
    ).toBe(false);
  });

  it("does NOT match unrelated errors or non-objects", () => {
    expect(isJobNumberUniqueViolation({ code: "42703", message: "undefined column" })).toBe(false);
    expect(isJobNumberUniqueViolation(null)).toBe(false);
    expect(isJobNumberUniqueViolation("boom")).toBe(false);
  });
});
