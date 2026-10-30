import { notFound } from "next/navigation";

import { JobDetailClient } from "@/features/jobs/components/JobDetailClient";
import { getJobCallbackContext } from "@/services/jobCallbacks";
import { getVisibleJobPrice } from "@/services/jobPrice";
import { getJob, listJobActivity, listJobNotesForJob } from "@/services/jobs";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [job, activity, notes, callbackContext, price] = await Promise.all([
    getJob(id),
    listJobActivity(id),
    listJobNotesForJob(id),
    getJobCallbackContext(id),
    getVisibleJobPrice(id),
  ]);

  if (!job) {
    notFound();
  }

  return (
    <JobDetailClient
      job={job}
      activity={activity}
      notes={notes}
      callbackContext={callbackContext}
      priceVisible={price.visible}
      priceCents={price.cents}
    />
  );
}
