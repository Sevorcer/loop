import { UserPlus, Users, Handshake } from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/features/auth";
import { ROUTES } from "@/lib/routes";

import { CustomerTable } from "../components/CustomerTable";

export function CustomersScreen() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 sm:inline-flex">
              <Handshake className="h-3.5 w-3.5" />
              Relationship Hub
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Customers
              </h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
                Manage customer accounts, primary contacts, and service
                relationships across every property you support.
              </p>
            </div>
          </div>

          <PermissionGate table="customers" action="insert">
            <Link href={`${ROUTES.CUSTOMERS}/new`}>
              <Button className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700 sm:w-auto">
                <UserPlus className="h-4 w-4" />
                New Customer
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
              <Users className="h-4 w-4 text-red-300 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">
                Customer Directory
              </h3>
              <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
                Search, filter, and organize every customer account in one
                place.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <CustomerTable />
        </div>
      </SurfaceCard>
    </div>
  );
}