import { describe, expect, it } from "vitest";

import { getPageMeta } from "@/components/layout/Header";
import { NAV_ROUTE_ROLES } from "@/features/auth";
import { ROUTES } from "@/lib/routes";
import { LIVE_REFRESH_MS, shouldRefresh } from "../utils/liveRefresh";

describe("Live refresh (60 s while visible)", () => {
  const start = 1_000_000;

  it("refreshes once a minute has passed and the tab is visible", () => {
    expect(LIVE_REFRESH_MS).toBe(60_000);
    expect(shouldRefresh("visible", start, start + 60_000)).toBe(true);
    expect(shouldRefresh("visible", start, start + 59_999)).toBe(false);
  });

  it("never refreshes while the tab is hidden", () => {
    expect(shouldRefresh("hidden", start, start + 10 * 60_000)).toBe(false);
  });
});

describe("Live tab access", () => {
  it("shows the Live tab to owner, manager, dispatch, and office — not sales, tech, or portal", () => {
    expect([...(NAV_ROUTE_ROLES[ROUTES.OPERATIONS_LIVE] ?? [])].sort()).toEqual(
      ["dispatch", "manager", "office", "owner"],
    );
  });

  it("titles the Live address under Operations", () => {
    const meta = getPageMeta(ROUTES.OPERATIONS_LIVE);
    expect(meta.title).toBe("Operations · Live");
    expect(meta.parent).toEqual({ title: "Operations", href: ROUTES.OPERATIONS });
  });
});
