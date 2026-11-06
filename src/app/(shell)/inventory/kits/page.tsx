import { KitsScreen } from "@/features/inventory/screens/KitsScreen";

export const dynamic = "force-dynamic";

interface KitsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default function KitsPage({ searchParams }: KitsPageProps) {
  return <KitsScreen searchParams={searchParams} />;
}
