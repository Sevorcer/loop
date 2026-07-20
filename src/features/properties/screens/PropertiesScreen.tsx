import { Building2, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { PropertyTable } from "../components/PropertyTable";

export function PropertiesScreen() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300 sm:inline-flex">
              <MapPinned className="h-3.5 w-3.5" />
              Portfolio View
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Properties
              </h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
                Manage every property, customer location, and installed HVAC
                system across your company.
              </p>
            </div>
          </div>

          <PermissionGuard table="properties" action="insert">
            <Link href={`${ROUTES.PROPERTIES}/new`}>
              <Button className="w-full gap-2 border border-blue-500/20 bg-gradient-to-r from-blue-500/80 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-700 sm:w-auto">
                <Building2 className="h-4 w-4" />
                New Property
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
              <ShieldCheck className="h-4 w-4 text-blue-300 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">
                Property Directory
              </h3>
              <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
                Search, filter, and organize every serviced property in one
                place.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <PropertyTable />
        </div>
      </SurfaceCard>
    </div>
  );
}