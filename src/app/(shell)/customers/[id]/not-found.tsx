import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function CustomerNotFoundPage() {
  return (
    <SurfaceCard className="mx-auto max-w-2xl">
      <div className="space-y-4 p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">Customer not found</h1>
        <p className="text-sm text-slate-400">
          The customer you&apos;re looking for doesn&apos;t exist or is no longer available.
        </p>

        <div className="flex justify-center">
          <Link href={ROUTES.CUSTOMERS}>
            <Button>Back to Customers</Button>
          </Link>
        </div>
      </div>
    </SurfaceCard>
  );
}
