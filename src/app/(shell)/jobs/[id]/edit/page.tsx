import { notFound } from "next/navigation";

import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { EditJobPageClient } from "@/features/jobs/components/EditJobPageClient";
import { getVisibleJobPrice } from "@/services/jobPrice";
import { getJob } from "@/services/jobs";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectTechFromOfficePath(`/jobs/${id}/edit`);

  const [job, price] = await Promise.all([getJob(id), getVisibleJobPrice(id)]);

  if (!job) {
    notFound();
  }

  return <EditJobPageClient job={job} priceVisible={price.visible} priceCents={price.cents} />;
}
