import { notFound } from "next/navigation";

import { JobDetailClient } from "@/features/jobs/components/JobDetailClient";
import { getJob, listJobActivity, listJobNotesForJob } from "@/services/jobs";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [job, activity, notes] = await Promise.all([
    getJob(id),
    listJobActivity(id),
    listJobNotesForJob(id),
  ]);

  if (!job) {
    notFound();
  }

  return <JobDetailClient job={job} activity={activity} notes={notes} />;
}
