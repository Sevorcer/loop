import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { NewJobForm } from "@/features/jobs/components/NewJobForm";
import { ROUTES } from "@/lib/routes";

interface NewJobPageProps {
  searchParams: Promise<{ customerId?: string; propertyId?: string }>;
}

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  await redirectTechFromOfficePath(`${ROUTES.JOBS}/new`);
  const params = await searchParams;

  return (
    <NewJobForm
      initialContext={{
        customerId: params.customerId,
        propertyId: params.propertyId,
      }}
    />
  );
}