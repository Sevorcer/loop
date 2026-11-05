import { ItemScreen } from "@/features/inventory/screens/ItemScreen";

export const dynamic = "force-dynamic";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
  return <ItemScreen itemId={id} />;
}
