import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockMaybeSingle,
  mockEq,
  mockSelect,
  mockFrom,
  mockSupabase,
  mockCreateSupabaseServerClient,
  mockGetSupabaseAdminClient,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockSupabase = {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  };

  return {
    mockGetUser,
    mockMaybeSingle,
    mockEq,
    mockSelect,
    mockFrom,
    mockSupabase,
    mockCreateSupabaseServerClient: vi.fn(async () => mockSupabase),
    mockGetSupabaseAdminClient: vi.fn(() => null),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: mockGetSupabaseAdminClient,
}));

import { getRepositoryContext } from "@/repositories/supabaseContext";

describe("getRepositoryContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NODE_ENV = "test";
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase);
    mockGetSupabaseAdminClient.mockReturnValue(null);
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("throws USER_PROFILE_NOT_FOUND with lookup diagnostics when the profile row is missing", async () => {
    await expect(getRepositoryContext({ userId: "user-123" })).rejects.toMatchObject({
      message: "USER_PROFILE_NOT_FOUND",
      code: "USER_PROFILE_NOT_FOUND",
      details: {
        table: "user_profiles",
        filters: { id: "user-123" },
        retrieval: "maybeSingle",
        lookup: "user_profiles.id -> org_id",
        userId: "user-123",
        reason: "profile_row_missing_or_rls_hidden",
      },
    });

    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockSelect).toHaveBeenCalledWith("id,org_id");
    expect(mockEq).toHaveBeenCalledWith("id", "user-123");
  });

  it("throws USER_PROFILE_NOT_FOUND with lookup diagnostics when org_id is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "user-123", org_id: null },
      error: null,
    });

    await expect(getRepositoryContext({ userId: "user-123" })).rejects.toMatchObject({
      message: "USER_PROFILE_NOT_FOUND",
      code: "USER_PROFILE_NOT_FOUND",
      details: {
        table: "user_profiles",
        filters: { id: "user-123" },
        retrieval: "maybeSingle",
        lookup: "user_profiles.id -> org_id",
        userId: "user-123",
        reason: "profile_org_id_missing",
      },
    });
  });

  it("returns the session org id when the profile lookup succeeds", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "user-123", org_id: "org-456" },
      error: null,
    });

    await expect(getRepositoryContext({ userId: "user-123" })).resolves.toMatchObject({
      orgId: "org-456",
      supabase: mockSupabase,
      mode: "session",
    });
  });
});
