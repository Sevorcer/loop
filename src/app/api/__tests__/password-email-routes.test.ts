import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getUserById, resetPasswordForEmail, profilesIn, resendOrgInvite } =
  vi.hoisted(() => ({
    requirePermissionMock: vi.fn(),
    getUserById: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    profilesIn: vi.fn(),
    resendOrgInvite: vi.fn(),
  }));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      resetPasswordForEmail,
      admin: { getUserById },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        in: profilesIn,
      }),
    }),
  }),
}));

vi.mock("@/services/settingsUsers", () => ({
  resendOrgInvite,
}));

import { POST as resetPassword } from "@/app/api/settings/users/[id]/reset-password/route";
import { POST as resendInvite } from "@/app/api/settings/users/[id]/resend-invite/route";

function authorized() {
  return { ok: true as const, ctx: { userId: "user-1", role: "owner" } };
}

describe("password email routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue(authorized());
  });

  it("sends password recovery to the reset page, not the missing /auth/reset-password path", async () => {
    getUserById.mockResolvedValue({
      data: { user: { email: "alex@example.com" } },
      error: null,
    });
    profilesIn.mockResolvedValue({
      data: [
        { id: "user-1", org_id: "org-1" },
        { id: "user-2", org_id: "org-1" },
      ],
    });
    resetPasswordForEmail.mockResolvedValue({ error: null });

    const response = await resetPassword(
      new Request("https://loop.example/api/settings/users/user-2/reset-password", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "user-2" }) },
    );

    expect(response.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("alex@example.com", {
      redirectTo: "https://loop.example/update-password",
    });
    const redirectTo = resetPasswordForEmail.mock.calls[0]?.[1].redirectTo as string;
    expect(redirectTo).not.toContain("/auth/reset-password");
    expect(redirectTo).not.toContain("flow=invite");
  });

  it("resends an invite with the request origin and does not take a role from the body", async () => {
    resendOrgInvite.mockResolvedValue(undefined);

    const response = await resendInvite(
      new Request("https://loop.example/api/settings/users/user-2/resend-invite", {
        method: "POST",
        body: JSON.stringify({ appRole: "owner" }),
      }),
      { params: Promise.resolve({ id: "user-2" }) },
    );

    expect(response.status).toBe(200);
    expect(resendOrgInvite).toHaveBeenCalledWith("user-1", "user-2", {
      origin: "https://loop.example",
    });
  });
});
