import { CountScreen } from "@/features/inventory/screens/CountScreen";

export const dynamic = "force-dynamic";

interface CountPageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function CountPage({ params }: CountPageProps) {
  const { vehicleId } = await params;
  return <CountScreen vehicleId={vehicleId} />;
}
