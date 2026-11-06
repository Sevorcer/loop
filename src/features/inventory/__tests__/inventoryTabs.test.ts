import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/routes";

import { activeInventoryTab, INVENTORY_TABS } from "../utils/inventoryTabs";

describe("inventory tabs", () => {
  it("lists Kits after Catalog and Rules last, each pointing at its route", () => {
    const keys = INVENTORY_TABS.map((tab) => tab.key);
    expect(keys).toEqual(["stock", "catalog", "kits", "needs-sku", "locations", "restock", "activity", "rules"]);
    expect(INVENTORY_TABS.find((tab) => tab.key === "restock")?.href).toBe(ROUTES.INVENTORY_RESTOCK);
    expect(INVENTORY_TABS.find((tab) => tab.key === "kits")?.href).toBe(ROUTES.INVENTORY_KITS);
    expect(INVENTORY_TABS.find((tab) => tab.key === "rules")?.href).toBe(ROUTES.INVENTORY_RULES);
  });

  it("keeps the Kits tab lit on a kit's editor page", () => {
    expect(activeInventoryTab(ROUTES.INVENTORY_KITS)).toBe("kits");
    expect(activeInventoryTab(`${ROUTES.INVENTORY_KITS}/abc`)).toBe("kits");
    expect(activeInventoryTab(ROUTES.INVENTORY_RULES)).toBe("rules");
  });

  it("lights Stock only on the exact inventory page", () => {
    expect(activeInventoryTab(ROUTES.INVENTORY)).toBe("stock");
    expect(activeInventoryTab("/inventory/unknown")).toBeNull();
  });

  it("lights Needs restock on its list and Locations on a van", () => {
    expect(activeInventoryTab(ROUTES.INVENTORY_RESTOCK)).toBe("restock");
    expect(activeInventoryTab(`${ROUTES.INVENTORY}/vans/abc`)).toBe("locations");
    expect(activeInventoryTab(`${ROUTES.INVENTORY}/vans/abc/pars`)).toBe("locations");
    expect(activeInventoryTab(`${ROUTES.INVENTORY}/vans/abc/count`)).toBe("locations");
  });
});
