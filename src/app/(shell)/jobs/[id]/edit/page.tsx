import { notFound } from "next/navigation";

import { EditJobPageClient } from "@/features/jobs/components/EditJobPageClient";
import { getJob } from "@/services/jobs";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await getJob(id);

  if (!job) {
    notFound();
  }

  return <EditJobPageClient job={job} />;
}
