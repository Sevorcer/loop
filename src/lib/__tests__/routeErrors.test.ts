import { describe, expect, it } from "vitest";

import { mapRouteError } from "@/lib/api/routeErrors";

describe("mapRouteError", () => {
  it("keeps missing user profiles in a controlled error state", async () => {
    const response = mapRouteError(
      Object.assign(new Error("USER_PROFILE_NOT_FOUND"), {
        code: "USER_PROFILE_NOT_FOUND",
        details: {
          table: "user_profiles",
          reason: "profile_row_missing_or_rls_hidden",
        },
      }),
    );

    expect(response.status).toBe(409);

    const body = (await response.json()) as {
      error: string;
      message: string;
      code: number;
      details: {
        table: string;
        reason: string;
      };
    };

    expect(body.error).toBe("PROFILE_UNAVAILABLE");
    expect(body.code).toBe(409);
    expect(body.message).toContain("still being provisioned");
    expect(body.details.reason).toBe("profile_row_missing_or_rls_hidden");
  });
});
