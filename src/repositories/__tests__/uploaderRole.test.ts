import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { uploaderRolesByUserId } from "@/repositories/storage";

describe("photo uploader role", () => {
  it("reads the role from app_role so a technician photo counts", () => {
    const roles = uploaderRolesByUserId([
      { id: "tech-1", app_role: "tech" },
      { id: "office-1", app_role: "owner" },
      { id: "blank-1", app_role: null },
    ]);

    expect(roles.get("tech-1")).toBe("tech");
    expect(roles.get("office-1")).toBe("owner");
    expect(roles.has("blank-1")).toBe(false);
  });

  it("queries user_profiles.app_role and not a role column", () => {
    const source = readFileSync(new URL("../storage.ts", import.meta.url), "utf8");
    expect(source).toContain('.select("id, app_role")');
    expect(source).not.toContain('.select("id, role")');
  });
});
