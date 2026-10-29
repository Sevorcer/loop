import type { InventoryItem, InventoryItemCategory } from "../types/inventory";

const CATEGORIES = new Set<InventoryItemCategory>([
  "Equipment",
  "Accessory",
  "Part",
  "Consumable",
  "Material",
]);

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isMissingInventoryTable(message: string): boolean {
  return /does not exist|schema cache|PGRST205|42P01|Could not find the table/i.test(message);
}

export function mapInventoryItem(row: Record<string, unknown>): InventoryItem | null {
  const id = asText(row.id);
  const name = asText(row.name);
  if (!id || !name) return null;
  const category = asText(row.category, "Material");
  const onHand = asNumber(row.quantity_on_hand ?? row.quantityOnHand);
  const reserved = asNumber(row.quantity_reserved ?? row.quantityReserved);
  return {
    id,
    sku: asText(row.sku),
    name,
    category: CATEGORIES.has(category as InventoryItemCategory)
      ? (category as InventoryItemCategory)
      : "Material",
    description: asText(row.description),
    unit: asText(row.unit, "each") || "each",
    quantityOnHand: onHand,
    quantityReserved: reserved,
    quantityAvailable: Math.max(0, onHand - reserved),
    warehouseLocation: asText(row.warehouse_location ?? row.warehouseLocation) || undefined,
    isSpecialOrder: Boolean(row.is_special_order ?? row.isSpecialOrder),
    isBackordered: Boolean(row.is_backordered ?? row.isBackordered),
    expectedArrival: asText(row.expected_arrival ?? row.expectedArrival) || undefined,
  };
}
