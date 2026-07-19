import { EditJobPageClient } from "@/features/jobs/components/EditJobPageClient";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditJobPageClient id={id} />;
}
