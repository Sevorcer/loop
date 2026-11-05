import { ROUTES } from "@/lib/routes";

export interface InventoryTabDef {
  key: "stock" | "catalog" | "locations" | "activity";
  label: string;
  href: string;
}

export const INVENTORY_TABS: readonly InventoryTabDef[] = [
  { key: "stock", label: "Stock", href: ROUTES.INVENTORY },
  { key: "catalog", label: "Catalog", href: ROUTES.INVENTORY_CATALOG },
  { key: "locations", label: "Locations & vans", href: ROUTES.INVENTORY_LOCATIONS },
  { key: "activity", label: "Activity", href: ROUTES.INVENTORY_ACTIVITY },
];

/** Active tab for a pathname; the Stock tab is exact so sub-routes do not light it up. */
export function activeInventoryTab(pathname: string): InventoryTabDef["key"] | null {
  const match = INVENTORY_TABS.filter((tab) => tab.key !== "stock").find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
  if (match) return match.key;
  return pathname === ROUTES.INVENTORY || pathname === `${ROUTES.INVENTORY}/` ? "stock" : null;
}
