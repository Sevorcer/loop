import { Building2, MapPinned, ShieldCheck } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { PropertyTable } from "../components/PropertyTable";

export function PropertiesScreen() {
  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <MapPinned className="h-3.5 w-3.5" />
              Portfolio View
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Properties
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage every property, customer location, and installed HVAC
                system across your company.
              </p>
            </div>
          </div>

          <Button className="gap-2 border border-blue-500/20 bg-gradient-to-r from-blue-500/80 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-700">
            <Building2 className="h-4 w-4" />
            New Property
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-cyan-500/10 ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5 text-blue-300" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                Property Directory
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Search, filter, and organize every serviced property in one
                place.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <PropertyTable />
        </div>
      </SurfaceCard>
    </div>
  );
}