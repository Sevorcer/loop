import { ActivityScreen } from "@/features/inventory/screens/ActivityScreen";

export const dynamic = "force-dynamic";

interface ActivityPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default function ActivityPage({ searchParams }: ActivityPageProps) {
  return <ActivityScreen searchParams={searchParams} />;
}
