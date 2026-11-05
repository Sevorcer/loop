/**
 * Pin tests for portalJobData.ts — verify select column lists and table
 * references match the real schema so broken queries can't hide behind mocks.
 *
 * These tests import the exported constants and check them against the
 * known-good column sets confirmed in the actual repositories and migrations.
 */

import {
  JOBS_SELECT_COLUMNS,
  JOB_ACTIVITY_SELECT_COLUMNS,
  JOB_ACTIVITY_TYPE_COLUMN,
  JOB_ASSIGNEES_TABLE,
  JOB_FILES_BUCKET,
  STORAGE_OBJECTS_TABLE,
  STORAGE_OBJECTS_SELECT_COLUMNS,
} from "../portalJobData";

// ─── Known-good column sets (from repositories + migrations) ─────────────────

/** Real columns on the `jobs` table used in portal queries. */
const REAL_JOBS_COLUMNS = [
  "id",
  "job_number",
  "status",
  "type",
  "scheduled_for",
  "property_id",
  "customer_id",
  "portal_money_visible",
];

/**
 * Real columns on the `job_activity` table.
 * Source: src/repositories/jobs.ts selects `id,job_id,actor_id,type,title,description,created_at`
 */
const REAL_JOB_ACTIVITY_COLUMNS = ["id", "type", "description", "created_at"];

/**
 * Real columns on the `storage_objects` table.
 * Source: src/repositories/storage.ts StorageObjectRow interface
 */
const REAL_STORAGE_OBJECTS_COLUMNS = [
  "id",
  "file_name",
  "bucket",
  "storage_path",
  "mime_type",
  "created_at",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a Supabase-style select string into a sorted array of column names. */
function parseSelectColumns(selectString: string): string[] {
  return selectString
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean)
    .sort();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("portalJobData schema pin tests", () => {
  describe("jobs table select", () => {
    it("selects only columns that exist on the jobs table", () => {
      const selected = parseSelectColumns(JOBS_SELECT_COLUMNS);
      expect(selected).toEqual(REAL_JOBS_COLUMNS.sort());
    });

    it("uses scheduled_for, NOT scheduled_date", () => {
      expect(JOBS_SELECT_COLUMNS).toContain("scheduled_for");
      expect(JOBS_SELECT_COLUMNS).not.toContain("scheduled_date");
    });

    it("does NOT select completed_date (derived from job_activity)", () => {
      expect(JOBS_SELECT_COLUMNS).not.toContain("completed_date");
    });
  });

  describe("job_activity table select", () => {
    it("selects only columns that exist on the job_activity table", () => {
      const selected = parseSelectColumns(JOB_ACTIVITY_SELECT_COLUMNS);
      expect(selected).toEqual(REAL_JOB_ACTIVITY_COLUMNS.sort());
    });

    it("uses type column, NOT activity_type", () => {
      expect(JOB_ACTIVITY_TYPE_COLUMN).toBe("type");
      expect(JOB_ACTIVITY_SELECT_COLUMNS).toContain("type");
      expect(JOB_ACTIVITY_SELECT_COLUMNS).not.toContain("activity_type");
    });
  });

  describe("job assignees table", () => {
    it("uses job_assignees, NOT job_assignments", () => {
      expect(JOB_ASSIGNEES_TABLE).toBe("job_assignees");
    });
  });

  describe("storage_objects for photos and documents", () => {
    it("uses storage_objects table, NOT property_photos or property_documents", () => {
      expect(STORAGE_OBJECTS_TABLE).toBe("storage_objects");
    });

    it("selects only columns that exist on the storage_objects table", () => {
      const selected = parseSelectColumns(STORAGE_OBJECTS_SELECT_COLUMNS);
      expect(selected).toEqual(REAL_STORAGE_OBJECTS_COLUMNS.sort());
    });

    it("uses the job-files bucket", () => {
      expect(JOB_FILES_BUCKET).toBe("job-files");
    });
  });
});
