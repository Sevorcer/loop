import { ParEditorScreen } from "@/features/inventory/screens/ParEditorScreen";

export const dynamic = "force-dynamic";

interface ParEditorPageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function ParEditorPage({ params }: ParEditorPageProps) {
  const { vehicleId } = await params;
  return <ParEditorScreen vehicleId={vehicleId} />;
}
