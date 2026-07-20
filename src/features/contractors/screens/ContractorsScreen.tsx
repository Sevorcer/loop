import { HardHat, UserPlus } from "lucide-react";
import Link from "next/link";

import { PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { ContractorTable, ContractorTableHeader } from "../components/ContractorTable";

export function ContractorsScreen() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 sm:inline-flex">
              <HardHat className="h-3.5 w-3.5" />
              Contractor Network
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Contractors
              </h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
                Manage your external contractor network and assign specialists
                to jobs.
              </p>
            </div>
          </div>

          <PermissionGuard table="contractors" action="insert">
            <Link href={`${ROUTES.CONTRACTORS}/new`} className="w-full sm:w-auto">
              <Button className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700">
                <UserPlus className="h-4 w-4" />
                Add Contractor
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <ContractorTableHeader />
        </div>

        <ContractorTable />
      </SurfaceCard>
    </div>
  );
}
