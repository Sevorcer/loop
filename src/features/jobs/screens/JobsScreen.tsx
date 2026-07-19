import { Briefcase, ClipboardList, Wrench } from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { JobTable } from "../components/JobTable";
import { JobsMetrics } from "../components/JobsMetrics";

export function JobsScreen() {
  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              <Wrench className="h-3.5 w-3.5" />
              Execution Center
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Jobs
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Track installs, service work, inspections, and maintenance jobs
                across the full execution lifecycle.
              </p>
            </div>
          </div>

          <Link href="/jobs/new" className="w-full sm:w-auto">
            <Button className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700">
              <Briefcase className="h-4 w-4" />
              New Job
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <JobsMetrics />

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
              <ClipboardList className="h-5 w-5 text-red-300" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">Job Board</h3>
              <p className="mt-1 text-sm text-slate-400">
                Review active work, monitor assignments, and keep install and
                service execution on schedule.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <JobTable />
        </div>
      </SurfaceCard>
    </div>
  );
}