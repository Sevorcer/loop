import { UserPlus, Users, Handshake } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { CustomerTable } from "../components/CustomerTable";

export function CustomersScreen() {
  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              <Handshake className="h-3.5 w-3.5" />
              Relationship Hub
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Customers
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage customer accounts, primary contacts, and service
                relationships across every property you support.
              </p>
            </div>
          </div>

          <Button className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700">
            <UserPlus className="h-4 w-4" />
            New Customer
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
              <Users className="h-5 w-5 text-red-300" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                Customer Directory
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Search, filter, and organize every customer account in one
                place.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <CustomerTable />
        </div>
      </SurfaceCard>
    </div>
  );
}