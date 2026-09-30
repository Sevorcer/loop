import { describe, expect, it } from "vitest";

import { getPageMeta } from "@/components/layout/Header";
import { ROUTES } from "@/lib/routes";

describe("getPageMeta", () => {
  it("resolves exact static routes", () => {
    expect(getPageMeta(ROUTES.COMMAND_CENTER).title).toBe("Command Center");
    expect(getPageMeta(ROUTES.CALENDAR).title).toBe("Calendar");
    expect(getPageMeta(ROUTES.CONTRACTORS).title).toBe("Contractors");
    expect(getPageMeta(ROUTES.OPERATIONS).title).toBe("Operations");
    expect(getPageMeta(ROUTES.SETTINGS_ROLES).title).toBe("Roles & Permissions");
  });

  it("resolves dynamic job routes most-specific first", () => {
    expect(getPageMeta(`${ROUTES.JOBS}/new`).title).toBe("New Job");
    expect(getPageMeta(`${ROUTES.JOBS}/abc/edit`).title).toBe("Edit Job");
    expect(getPageMeta(`${ROUTES.JOBS}/abc`).title).toBe("Job Details");
  });

  it("attaches parent crumbs for nested pages", () => {
    const meta = getPageMeta(`${ROUTES.JOBS}/abc`);
    expect(meta.parent).toEqual({ title: "Jobs", href: ROUTES.JOBS });

    const settingsMeta = getPageMeta(ROUTES.SETTINGS_USERS);
    expect(settingsMeta.parent).toEqual({ title: "Settings", href: ROUTES.SETTINGS });
  });

  it("falls back to Dashboard for unknown routes", () => {
    expect(getPageMeta("/some/unknown/route").title).toBe("Dashboard");
  });
});
