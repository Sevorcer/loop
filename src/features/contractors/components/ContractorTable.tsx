"use client";

import { useState } from "react";
import { HardHat, Search } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/routes";
import { PhoneLink } from "@/components/atlas";

import { useContractors } from "../state/ContractorsProvider";
import type { Contractor } from "../types/contractor";

function ContractorRow({ contractor }: { contractor: Contractor }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-4 last:border-0 sm:grid-cols-4 sm:items-center sm:gap-4 sm:px-6">
      <div>
        <p className="text-sm font-medium text-white">
          {contractor.companyName}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{contractor.contactName}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          Email
        </p>
        <p className="text-sm text-slate-300">{contractor.email}</p>
        {contractor.phone ? (
          <p className="mt-0.5 text-xs text-slate-400">
            <PhoneLink
              phone={contractor.phone}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            />
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          Trade
        </p>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          {contractor.trade || "General"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={[
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            contractor.active
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-slate-500/15 text-slate-400",
          ].join(" ")}
        >
          {contractor.active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

export function ContractorTable() {
  const { contractors } = useContractors();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? contractors.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.companyName.toLowerCase().includes(q) ||
          c.contactName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.trade.toLowerCase().includes(q)
        );
      })
    : contractors;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contractors…"
            className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-9 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          {search ? "No contractors match your search." : "No contractors yet."}{" "}
          <Link
            href={`${ROUTES.CONTRACTORS}/new`}
            className="text-blue-400 hover:underline"
          >
            Add one
          </Link>
          .
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-4 gap-4 border-b border-white/10 px-6 py-2 sm:grid">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Company / Contact
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Email / Phone
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Trade
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status
            </p>
          </div>

          {filtered.map((contractor) => (
            <ContractorRow key={contractor.id} contractor={contractor} />
          ))}
        </div>
      )}

      <div className="border-t border-white/10 px-4 py-3 sm:px-6">
        <p className="text-xs text-slate-500">
          {filtered.length} contractor{filtered.length !== 1 ? "s" : ""}
          {search ? " found" : " total"}
        </p>
      </div>
    </div>
  );
}

export function ContractorTableHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
        <HardHat className="h-4 w-4 text-red-300 sm:h-5 sm:w-5" />
      </div>

      <div>
        <h3 className="text-base font-semibold text-white sm:text-lg">
          Contractor Directory
        </h3>
        <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
          Search and manage all contractors available for job assignments.
        </p>
      </div>
    </div>
  );
}
