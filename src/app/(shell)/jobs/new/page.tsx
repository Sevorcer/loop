import { NewJobForm } from "@/features/jobs/components/NewJobForm";

interface NewJobPageProps {
  searchParams: Promise<{ customerId?: string; propertyId?: string }>;
}

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
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