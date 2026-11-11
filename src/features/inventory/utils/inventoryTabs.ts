import { ROUTES } from "@/lib/routes";

export interface InventoryTabDef {
  key: "stock" | "catalog" | "kits" | "needs-sku" | "serials" | "pulls" | "restock" | "arrivals" | "locations" | "activity" | "rules";
  label: string;
  href: string;
}

export const INVENTORY_TABS: readonly InventoryTabDef[] = [
  { key: "stock", label: "Stock", href: ROUTES.INVENTORY },
  { key: "catalog", label: "Catalog", href: ROUTES.INVENTORY_CATALOG },
  { key: "kits", label: "Kits", href: ROUTES.INVENTORY_KITS },
  { key: "needs-sku", label: "Needs SKU", href: ROUTES.INVENTORY_NEEDS_SKU },
  { key: "serials", label: "Serials", href: ROUTES.INVENTORY_SERIALS },
  { key: "pulls", label: "Pulls", href: ROUTES.INVENTORY_PULLS },
  { key: "restock", label: "Needs restock", href: ROUTES.INVENTORY_RESTOCK },
  { key: "arrivals", label: "Arrivals", href: ROUTES.INVENTORY_ARRIVALS },
  { key: "locations", label: "Locations & vans", href: ROUTES.INVENTORY_LOCATIONS },
  { key: "activity", label: "Activity", href: ROUTES.INVENTORY_ACTIVITY },
  { key: "rules", label: "Rules", href: ROUTES.INVENTORY_RULES },
];

/** Active tab for a pathname; the Stock tab is exact so sub-routes do not light it up. */
export function activeInventoryTab(pathname: string): InventoryTabDef["key"] | null {
  const match = INVENTORY_TABS.filter((tab) => tab.key !== "stock").find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
  if (match) return match.key;
  // Van stock and the par editor are reached from Locations & vans.
  if (pathname === `${ROUTES.INVENTORY}/vans` || pathname.startsWith(`${ROUTES.INVENTORY}/vans/`)) {
    return "locations";
  }
  return pathname === ROUTES.INVENTORY || pathname === `${ROUTES.INVENTORY}/` ? "stock" : null;
}
