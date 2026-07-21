import { notFound } from "next/navigation";

import { JobDetailScreen } from "@/features/jobs/components/JobDetailScreen";
import { getJob, listJobActivity } from "@/services/jobs";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [job, activity] = await Promise.all([getJob(id), listJobActivity(id)]);

  if (!job) {
    notFound();
  }

  return <JobDetailScreen job={job} initialActivity={activity} />;
}