import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

export default function JobNotFoundPage() {
  return (
    <SurfaceCard className="mx-auto max-w-2xl">
      <div className="space-y-4 p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">Job not found</h1>
        <p className="text-sm text-slate-400">
          The job you’re looking for doesn’t exist or is no longer available.
        </p>

        <div className="flex justify-center">
          <Link href="/jobs">
            <Button>Back to Jobs</Button>
          </Link>
        </div>
      </div>
    </SurfaceCard>
  );
}