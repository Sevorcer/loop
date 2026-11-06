import { KitScreen } from "@/features/inventory/screens/KitScreen";

export const dynamic = "force-dynamic";

interface KitPageProps {
  params: Promise<{ id: string }>;
}

export default async function KitPage({ params }: KitPageProps) {
  const { id } = await params;
  return <KitScreen kitId={id} />;
}
