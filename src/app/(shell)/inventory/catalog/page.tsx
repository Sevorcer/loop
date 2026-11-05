import { CatalogScreen } from "@/features/inventory/screens/CatalogScreen";

export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default function CatalogPage({ searchParams }: CatalogPageProps) {
  return <CatalogScreen searchParams={searchParams} />;
}
