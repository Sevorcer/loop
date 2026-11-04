"use client";

import { useState } from "react";
import { Check, X, Ban, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/atlas";
import type { ReadyToBillJob } from "../types/billing";

interface ReadyToBillTableProps {
  jobs: ReadyToBillJob[];
  onMarkBilled: (jobId: string, qbInvoiceNumber: string, billedAt: string) => Promise<void>;
  onExclude: (jobId: string) => Promise<void>;
  isLoading: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BillingRowProps {
  job: ReadyToBillJob;
  onMarkBilled: (jobId: string, qbInvoiceNumber: string, billedAt: string) => Promise<void>;
  onExclude: (jobId: string) => Promise<void>;
}

function BillingRow({ job, onMarkBilled, onExclude }: BillingRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [billedAt, setBilledAt] = useState(todayIso());
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!invoiceNumber.trim()) return;
    setIsSaving(true);
    try {
      await onMarkBilled(job.id, invoiceNumber.trim(), billedAt);
      setIsEditing(false);
      setInvoiceNumber("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExclude() {
    setIsSaving(true);
    try {
      await onExclude(job.id);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <tr className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
      <td className="px-4 py-3 text-sm font-medium text-slate-200">
        {job.jobNumber}
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">{job.customerName}</td>
      <td className="hidden px-4 py-3 text-sm text-slate-400 md:table-cell">
        {job.propertyName}
      </td>
      <td className="hidden px-4 py-3 text-sm text-slate-400 lg:table-cell">
        {formatDate(job.completedAt)}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="QB Invoice #"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="h-8 w-32 text-sm"
              autoFocus
            />
            <Input
              type="date"
              value={billedAt}
              onChange={(e) => setBilledAt(e.target.value)}
              className="h-8 w-36 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving || !invoiceNumber.trim()}
              className="h-8 px-2 text-emerald-400 hover:text-emerald-300"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIsEditing(false); setInvoiceNumber(""); }}
              className="h-8 px-2 text-slate-400 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
              className="h-8 gap-1.5 text-xs text-slate-300 hover:text-white"
            >
              <Check className="h-3.5 w-3.5" />
              Mark Billed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExclude}
              disabled={isSaving}
              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-slate-300"
              title="Exclude from billing (warranty, no-charge, internal)"
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function ReadyToBillTable({
  jobs,
  onMarkBilled,
  onExclude,
  isLoading,
}: ReadyToBillTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="All caught up"
        description="No jobs waiting to be billed."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              Job
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              Customer
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 md:table-cell">
              Site
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell">
              Completed
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <BillingRow
              key={job.id}
              job={job}
              onMarkBilled={onMarkBilled}
              onExclude={onExclude}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
