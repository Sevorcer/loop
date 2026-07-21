import { notFound } from "next/navigation";

import { JobDetailClient } from "@/features/jobs/components/JobDetailClient";
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

  return <JobDetailClient job={job} activity={activity} />;
}