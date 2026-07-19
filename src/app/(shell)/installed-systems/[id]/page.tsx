import { InstalledSystemDetailPageClient } from "@/features/installed-systems/components/InstalledSystemDetailPageClient";

export default async function InstalledSystemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <InstalledSystemDetailPageClient id={id} />;
}
