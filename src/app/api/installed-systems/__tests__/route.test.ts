import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getInstalledSystemsSnapshotMock = vi.fn();
const getInstalledSystemByIdMock = vi.fn();

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: getInstalledSystemsSnapshotMock,
}));

vi.mock("@/repositories/installedSystems", () => ({
  getInstalledSystemById: getInstalledSystemByIdMock,
}));

import { GET as getInstalledSystems } from "@/app/api/installed-systems/route";
import { GET as getInstalledSystemById } from "@/app/api/installed-systems/[id]/route";

describe("GET /api/installed-systems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstalledSystemsSnapshotMock.mockResolvedValue({
      installedSystems: [],
      technicalProfiles: [],
    });
  });

  it("returns 401 when role is missing", async () => {
    const response = await getInstalledSystems(new Request("http://localhost/api/installed-systems"));
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for portal role deny-by-default", async () => {
    const response = await getInstalledSystems(
      new Request("http://localhost/api/installed-systems", {
        headers: { "x-loop-role": "portal" },
      }),
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
    expect(body.code).toBe(403);
  });
});

describe("GET /api/installed-systems/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 envelope when installed system is missing", async () => {
    getInstalledSystemByIdMock.mockResolvedValue({ ok: true, data: null });

    const response = await getInstalledSystemById(
      new Request("http://localhost/api/installed-systems/sys-404", {
        headers: { "x-loop-role": "manager" },
      }),
      { params: Promise.resolve({ id: "sys-404" }) },
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(404);
    expect(body.error).toBe("NOT_FOUND");
    expect(body.code).toBe(404);
  });

  it("maps repository unauthorized errors to 401 envelope", async () => {
    getInstalledSystemByIdMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "A valid session is required." },
    });

    const response = await getInstalledSystemById(
      new Request("http://localhost/api/installed-systems/sys-401", {
        headers: { "x-loop-role": "owner" },
      }),
      { params: Promise.resolve({ id: "sys-401" }) },
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });
});
