import { MyVanScreen } from "@/features/inventory/screens/MyVanScreen";

export const dynamic = "force-dynamic";

export default function MyVanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MyVanScreen searchParams={searchParams} />;
}
