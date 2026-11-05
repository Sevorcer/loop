import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { NewJobForm } from "@/features/jobs/components/NewJobForm";
import { ROUTES } from "@/lib/routes";

interface NewJobPageProps {
  searchParams: Promise<{ customerId?: string; propertyId?: string; date?: string }>;
}

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  await redirectTechFromOfficePath(`${ROUTES.JOBS}/new`);
  const params = await searchParams;
  // Calendar "Add → Job" passes ?date=YYYY-MM-DD; anything else is ignored.
  const initialDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;

  return (
    <NewJobForm
      initialContext={{
        customerId: params.customerId,
        propertyId: params.propertyId,
      }}
      initialDate={initialDate}
    />
  );
}
