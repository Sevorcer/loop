import { PropertiesScreen } from "@/features/properties";

export const dynamic = "force-dynamic";

interface PropertiesPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    type?: string;
    city?: string;
  }>;
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const query = await searchParams;
  return (
    <PropertiesScreen
      search={query.q ?? ""}
      page={query.page ?? ""}
      status={query.status ?? ""}
      type={query.type ?? ""}
      city={query.city ?? ""}
    />
  );
}
