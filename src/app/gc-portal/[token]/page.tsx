import type { Metadata } from "next";
import { GcPortalScreen } from "@/features/gc-portal/screens/GcPortalScreen";

export const metadata: Metadata = { title: "Job Progress" };

/**
 * GC Portal page — Task 2
 *
 * Renders the builder-facing portal view for a single job,
 * resolved via the share-link token in the URL.
 */
export default async function GcPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GcPortalScreen token={token} />;
}
