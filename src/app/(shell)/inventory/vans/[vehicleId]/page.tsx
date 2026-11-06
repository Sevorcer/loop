import { VanStockScreen } from "@/features/inventory/screens/VanStockScreen";

export const dynamic = "force-dynamic";

interface VanStockPageProps {
  params: Promise<{ vehicleId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VanStockPage({ params, searchParams }: VanStockPageProps) {
  const { vehicleId } = await params;
  return <VanStockScreen vehicleId={vehicleId} searchParams={searchParams} />;
}
