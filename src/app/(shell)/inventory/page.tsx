import { StockScreen } from "@/features/inventory";

export const dynamic = "force-dynamic";

export default function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StockScreen searchParams={searchParams} />;
}
