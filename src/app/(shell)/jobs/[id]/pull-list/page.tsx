import { PullListScreen } from "@/features/inventory/screens/PullListScreen";

export const dynamic = "force-dynamic";

export default async function PullListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PullListScreen jobId={id} />;
}
