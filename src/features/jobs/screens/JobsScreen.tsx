"use client";

import { Briefcase, CalendarDays, ClipboardList, Wrench } from "lucide-react";
import Link from "next/link";

import { PermissionGuard } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES, ROUTE_BUILDERS } from "@/lib/routes";

import { JobTable } from "../components/JobTable";
import { JobsMetrics } from "../components/JobsMetrics";

type SearchParamValue = string | string[] | undefined;

interface JobsScreenProps {
  initialSearchParams?: Record<string, SearchParamValue>;
}

export function JobsScreen({ initialSearchParams }: JobsScreenProps) {
  const { role } = useCurrentRole();
  const isTech = role === "tech";

  return (
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 sm:inline-flex">
              <Wrench className="h-3.5 w-3.5" />
              Execution Center
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                {isTech ? "My Jobs Today" : "Jobs"}
              </h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
                {isTech
                  ? "Start assigned work, capture field updates, and complete jobs from your mobile workflow."
                  : "Track installs, service work, inspections, and maintenance jobs across the full execution lifecycle."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href={ROUTES.CALENDAR} className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full gap-2 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar View
              </Button>
            </Link>

            <PermissionGuard table="jobs" action="insert">
              <Link href={ROUTE_BUILDERS.JOB_NEW()} className="w-full sm:w-auto">
                <Button className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700">
                  <Briefcase className="h-4 w-4" />
                  New Job
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </SurfaceCard>

      <JobsMetrics />

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
              <ClipboardList className="h-4 w-4 text-red-300 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">Job Board</h3>
              <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
                Review active work, monitor assignments, and keep install and
                service execution on schedule.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <JobTable initialSearchParams={initialSearchParams} />
        </div>
      </SurfaceCard>
    </div>
  );
}
