import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <AppShell>
      <SurfaceCard className="mx-auto max-w-2xl">
        <div className="space-y-4 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            404
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Page not found
          </h1>
          <p className="text-sm text-slate-400">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <div className="flex justify-center">
            <Link href={ROUTES.DASHBOARD}>
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </SurfaceCard>
    </AppShell>
  );
}
