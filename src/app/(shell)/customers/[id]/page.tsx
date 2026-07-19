import { CustomerDetailClient } from "./CustomerDetailClient";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  return <CustomerDetailClient id={id} />;
}
