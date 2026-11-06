import { describe, expect, it } from "vitest";

import { getPageMeta } from "@/components/layout/Header";
import { ROUTES } from "@/lib/routes";

describe("getPageMeta", () => {
  it("resolves exact static routes", () => {
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

  it("names van stock, pars, and needs restock", () => {
    expect(getPageMeta(ROUTES.INVENTORY_RESTOCK).title).toBe("Needs restock");
    expect(getPageMeta(ROUTES.INVENTORY_RESTOCK).parent).toEqual({ title: "Inventory", href: ROUTES.INVENTORY });
    expect(getPageMeta(`${ROUTES.INVENTORY}/vans/abc`).title).toBe("Van stock");
    expect(getPageMeta(`${ROUTES.INVENTORY}/vans/abc/pars`).title).toBe("Edit pars");
    expect(getPageMeta(`${ROUTES.INVENTORY}/vans/abc/count`).title).toBe("Count in");
    expect(getPageMeta(ROUTES.INVENTORY_MY_VAN).title).toBe("My van");
    expect(getPageMeta(ROUTES.INVENTORY_MY_VAN).parent).toBeUndefined();
  });

  it("falls back to Dashboard for unknown routes", () => {
    expect(getPageMeta("/some/unknown/route").title).toBe("Dashboard");
  });
});
