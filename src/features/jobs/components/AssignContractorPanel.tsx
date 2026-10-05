"use client";

import { useState } from "react";
import { HardHat, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { useContractors } from "@/features/contractors/state/ContractorsProvider";

import { useJobs } from "../state/JobsProvider";

interface AssignContractorPanelProps {
  jobId: string;
}

export function AssignContractorPanel({ jobId }: AssignContractorPanelProps) {
  const { getJobById, assignContractor, removeContractorAssignment } =
    useJobs();
  const { contractors } = useContractors();

  const job = getJobById(jobId);
  const assignedIds = job?.contractorIds ?? [];
  const assignedContractors = contractors.filter((c) =>
    assignedIds.includes(c.id)
  );
  const available = contractors.filter(
    (c) => c.active && !assignedIds.includes(c.id)
  );

  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAssign() {
    if (!selectedId) {
      return;
    }

    setError(null);
    setSuccess(null);

    let result: { ok: true } | { ok: false; error: string };
    try {
      result = await assignContractor(jobId, selectedId);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to assign contractor."
      );
      return;
    }

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const contractor = contractors.find((c) => c.id === selectedId);
    setSuccess(
      `${contractor?.companyName ?? "Contractor"} assigned successfully.`
    );
    setSelectedId("");
  }

  async function handleRemove(contractorId: string) {
    setError(null);
    setSuccess(null);
    try {
      await removeContractorAssignment(jobId, contractorId);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to remove contractor."
      );
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
            <HardHat className="h-4 w-4 text-red-300" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Assigned Contractors
          </h2>
        </div>

        {assignedContractors.length > 0 ? (
          <div className="mt-4 space-y-2">
            {assignedContractors.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {c.companyName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.contactName}
                    {c.trade ? ` · ${c.trade}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => void handleRemove(c.id)}
                  // F14: glove-sized remove target.
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-red-300"
                  aria-label={`Remove ${c.companyName}`}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No contractors assigned yet.
          </p>
        )}

        {available.length > 0 ? (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assign Contractor
            </p>

            <div className="flex gap-2">
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                <option value="">Select contractor…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                    {c.trade ? ` (${c.trade})` : ""}
                  </option>
                ))}
              </select>

              <Button
                onClick={() => void handleAssign()}
                disabled={!selectedId}
                className="gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                Assign
              </Button>
            </div>
          </div>
        ) : contractors.length > 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            All active contractors are already assigned.
          </p>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            No contractors available.{" "}
            <Link
              href={`${ROUTES.CONTRACTORS}/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Add one
            </Link>
            .
          </p>
        )}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {success}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
