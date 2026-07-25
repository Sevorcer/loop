import { beforeEach, describe, expect, it, vi } from "vitest";

const { beginClientAuthRecoveryMock } = vi.hoisted(() => ({
  beginClientAuthRecoveryMock: vi.fn(),
}));

vi.mock("@/lib/auth/clientRecovery", () => ({
  beginClientAuthRecovery: beginClientAuthRecoveryMock,
}));

import { ApiRequestError, requestJson } from "@/lib/api/client";

describe("requestJson auth contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    beginClientAuthRecoveryMock.mockReset();
  });

  it("starts client auth recovery on 401 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "UNAUTHORIZED",
            message: "Your session has expired. Please sign in again.",
            code: 401,
            reason: "expired_token",
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    await expect(requestJson("/api/jobs")).rejects.toMatchObject<ApiRequestError>({
      status: 401,
      reason: "expired_token",
      code: "UNAUTHORIZED",
    });
    expect(beginClientAuthRecoveryMock).toHaveBeenCalledWith("expired_token");
  });

  it("does not start client auth recovery on 403 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "FORBIDDEN",
            message: "You do not have permission to perform this action.",
            code: 403,
            reason: "insufficient_permission",
          }),
          {
            status: 403,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    await expect(requestJson("/api/jobs")).rejects.toMatchObject<ApiRequestError>({
      status: 403,
      reason: "insufficient_permission",
      code: "FORBIDDEN",
    });
    expect(beginClientAuthRecoveryMock).not.toHaveBeenCalled();
  });
});
