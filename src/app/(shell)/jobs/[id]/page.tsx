import { JobDetailPageClient } from "@/features/jobs/components/JobDetailPageClient";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <JobDetailPageClient id={id} />;
}