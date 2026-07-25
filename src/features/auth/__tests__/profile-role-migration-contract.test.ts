import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("user_profiles app_role migration contract", () => {
  it("keeps the baseline Supabase migration with NOT NULL and CHECK protection on app_role", () => {
    const sql = readRepositoryFile("supabase/migrations/20260719000001_baseline_core_schema.sql");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_profiles");
    expect(sql).toContain("app_role    text NOT NULL CHECK (");
    expect(sql).toContain("app_role IN ('owner','manager','dispatch','tech','office','sales','portal')");
  });

  it("keeps the reference baseline migration aligned for user_profiles app_role", () => {
    const sql = readRepositoryFile("database/migrations/001_core_schema.sql");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_profiles");
    expect(sql).toContain("app_role    text NOT NULL CHECK (");
    expect(sql).toContain("app_role IN ('owner','manager','dispatch','tech','office','sales','portal')");
  });
});
