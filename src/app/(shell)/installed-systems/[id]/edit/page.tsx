import { InstalledSystemEditPageClient } from "@/features/installed-systems/components/InstalledSystemEditPageClient";

export default async function EditInstalledSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InstalledSystemEditPageClient id={id} />;
}
