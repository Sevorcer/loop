import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { runDbHealthChecks } = vi.hoisted(() => ({
  runDbHealthChecks: vi.fn(),
}));

vi.mock("@/services/dbHealth", () => ({
  runDbHealthChecks,
}));

import { POST as postHealthCheck } from "@/app/api/admin/db-health/check/route";
import { POST as postSmokeTest } from "@/app/api/admin/smoke-test/route";

const TOKEN = "ci-health-token";

function post(url: string, authorization?: string, body = "{}") {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request(url, { method: "POST", headers, body });
}

describe("CI token routes reject a missing or invalid bearer token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LOOP_HEALTH_CHECK_TOKEN", TOKEN);
    runDbHealthChecks.mockResolvedValue({
      overallStatus: "pass",
      failCount: 0,
      results: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when the health-check token is not configured", async () => {
    vi.stubEnv("LOOP_HEALTH_CHECK_TOKEN", "");
    const response = await postHealthCheck(
      post("https://loop.example/api/admin/db-health/check", `Bearer ${TOKEN}`),
    );
    expect(response.status).toBe(503);
    expect(runDbHealthChecks).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or invalid health-check token and 200 for the real one", async () => {
    const missing = await postHealthCheck(post("https://loop.example/api/admin/db-health/check"));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: "UNAUTHORIZED", reason: "missing_token" });

    const invalid = await postHealthCheck(
      post("https://loop.example/api/admin/db-health/check", "Bearer wrong-token"),
    );
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({ error: "UNAUTHORIZED", reason: "invalid_token" });

    const wrongScheme = await postHealthCheck(
      post("https://loop.example/api/admin/db-health/check", `Basic ${TOKEN}`),
    );
    expect(wrongScheme.status).toBe(401);

    expect(runDbHealthChecks).not.toHaveBeenCalled();

    const accepted = await postHealthCheck(
      post("https://loop.example/api/admin/db-health/check", `Bearer ${TOKEN}`),
    );
    expect(accepted.status).toBe(200);
    expect(runDbHealthChecks).toHaveBeenCalledOnce();
  });

  it("returns 503 when the smoke-test token is not configured", async () => {
    vi.stubEnv("LOOP_HEALTH_CHECK_TOKEN", "");
    const response = await postSmokeTest(
      post("https://loop.example/api/admin/smoke-test", `Bearer ${TOKEN}`),
    );
    expect(response.status).toBe(503);
  });

  it("returns 401 for a missing or invalid smoke-test token, then continues past auth", async () => {
    const missing = await postSmokeTest(post("https://loop.example/api/admin/smoke-test"));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ reason: "missing_token" });

    const invalid = await postSmokeTest(
      post("https://loop.example/api/admin/smoke-test", "Bearer wrong-token"),
    );
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({ reason: "invalid_token" });

    const accepted = await postSmokeTest(
      post("https://loop.example/api/admin/smoke-test", `Bearer ${TOKEN}`, "{}"),
    );
    expect(accepted.status).toBe(400);
    expect(await accepted.json()).toMatchObject({
      error: "smokeUserEmail and smokeUserPassword are required.",
    });
  });
});
