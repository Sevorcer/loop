import { RestockScreen } from "@/features/inventory/screens/RestockScreen";

export const dynamic = "force-dynamic";

export default function RestockPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RestockScreen searchParams={searchParams} />;
}
