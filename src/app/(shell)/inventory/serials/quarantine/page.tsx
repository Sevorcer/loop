import { QuarantineScreen } from "@/features/inventory/screens/QuarantineScreen";

export const dynamic = "force-dynamic";

interface QuarantinePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default function QuarantinePage({ searchParams }: QuarantinePageProps) {
  return <QuarantineScreen searchParams={searchParams} />;
}
