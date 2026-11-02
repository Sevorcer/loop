import { CustomersScreen } from "@/features/customers";

export const dynamic = "force-dynamic";

interface CustomersPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    city?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const query = await searchParams;
  return (
    <CustomersScreen
      search={query.q ?? ""}
      page={query.page ?? ""}
      status={query.status ?? ""}
      city={query.city ?? ""}
    />
  );
}
