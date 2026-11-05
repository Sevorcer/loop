import type { StockSnapshot } from "../utils/stockView";

export interface StockItemOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
}

export interface StockLocationOption {
  id: string;
  label: string;
}

export interface StockDialogData {
  items: StockItemOption[];
  locations: StockLocationOption[];
  stock: StockSnapshot[];
}

export function itemLabel(item: StockItemOption): string {
  return item.sku ? `${item.name} (${item.sku})` : item.name;
}
