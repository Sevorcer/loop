import { NewPropertyForm } from "@/features/properties/components/NewPropertyForm";

interface NewPropertyPageProps {
  searchParams: Promise<{ customerId?: string }>;
}

export default async function NewPropertyPage({ searchParams }: NewPropertyPageProps) {
  const params = await searchParams;

  return <NewPropertyForm initialCustomerId={params.customerId} />;
}
