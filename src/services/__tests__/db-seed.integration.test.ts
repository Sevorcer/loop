import { execFileSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DB_SEED_FIXTURE_IDS } from "@/testing/dbSeedFixtures";

const repoRoot = path.resolve(__dirname, "../../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function runSeedDryRun(): string {
  const bashPath = process.env.BASH_PATH;

  if (bashPath) {
    return execFileSync(bashPath, ["scripts/db/seed.sh", "--dry-run"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
  }

  return execSync("bash scripts/db/seed.sh --dry-run", {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

describe("db seed fixtures", () => {
  it("produce deterministic dry-run output with idempotent upserts", () => {
    const first = runSeedDryRun();
    const second = runSeedDryRun();

    expect(first).toBe(second);
    expect(first).toContain("ON CONFLICT (id) DO UPDATE");
    expect(first).not.toContain("gen_random_uuid()");
  });

  it("uses deterministic golden-path records for a seeded workflow", () => {
    const goldenJobs = read("database/fixtures/golden_path/30_jobs.sql");
    const goldenDispatch = read("database/fixtures/golden_path/40_dispatch.sql");
    const goldenDocs = read("database/fixtures/golden_path/50_documents_manuals.sql");

    expect(goldenJobs).toContain(DB_SEED_FIXTURE_IDS.jobs.goldenInstallHandoff);
    expect(goldenJobs).toContain(DB_SEED_FIXTURE_IDS.customers.goldenRiverstone);
    expect(goldenJobs).toContain(DB_SEED_FIXTURE_IDS.properties.goldenRiverstoneCondos);

    expect(goldenDispatch).toContain(DB_SEED_FIXTURE_IDS.jobs.goldenInstallHandoff);
    expect(goldenDispatch).toContain(DB_SEED_FIXTURE_IDS.jobActivity.goldenDispatchPlan);
    expect(goldenDispatch).toContain(DB_SEED_FIXTURE_IDS.jobActivity.goldenCrewDispatched);

    expect(goldenDocs).toContain(DB_SEED_FIXTURE_IDS.jobs.goldenInstallHandoff);
    expect(goldenDocs).toContain(DB_SEED_FIXTURE_IDS.jobActivity.goldenDocumentUploaded);
    expect(goldenDocs).toContain(DB_SEED_FIXTURE_IDS.jobActivity.goldenManualLinked);
  });

  it("keeps reset ordering dependency-safe for reseed", () => {
    const resetScript = read("database/fixtures/reset/20_baseline.sql");
    const jobActivityDelete = resetScript.indexOf("DELETE FROM job_activity");
    const jobsDelete = resetScript.indexOf("DELETE FROM jobs");
    const propertiesDelete = resetScript.indexOf("DELETE FROM properties");
    const customersDelete = resetScript.indexOf("DELETE FROM customers");
    const organizationsDelete = resetScript.indexOf("DELETE FROM organizations");

    expect(jobActivityDelete).toBeGreaterThanOrEqual(0);
    expect(jobsDelete).toBeGreaterThan(jobActivityDelete);
    expect(propertiesDelete).toBeGreaterThan(jobsDelete);
    expect(customersDelete).toBeGreaterThan(propertiesDelete);
    expect(organizationsDelete).toBeGreaterThan(customersDelete);
  });
});