"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, DollarSign, FileText, Pencil, Plus, Trash2 } from "lucide-react";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { pushToast } from "@/components/ui/toast";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { formatCentsAsUsd } from "@/lib/money";

import type { JobBid, JobBidStatus } from "../types/jobBid";
import { JOB_BID_STATUSES } from "../types/jobBid";

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

function bidStatusVariant(status: JobBidStatus) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "sent":
      return "info" as const;
    case "draft":
      return "neutral" as const;
    case "declined":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function bidStatusLabel(status: JobBidStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------------
// Inline form
// ---------------------------------------------------------------------------

interface BidFormProps {
  jobId: string;
  role: string | null;
  initial?: JobBid | null;
  onSaved: () => void;
  onCancel: () => void;
}

function BidForm({ jobId, role, initial, onSaved, onCancel }: BidFormProps) {
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [status, setStatus] = useState<string>(initial?.status ?? "draft");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await requestJson(`/api/jobs/${jobId}/bids/${initial.id}`, {
          method: "PUT",
          role,
          body: { amount, status, notes },
        });
        pushToast("Bid updated.", "success");
      } else {
        await requestJson(`/api/jobs/${jobId}/bids`, {
          method: "POST",
          role,
          body: { amount, status, notes },
        });
        pushToast("Bid created.", "success");
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save bid.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void save(e)}>
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="bid-amount">
        Amount
        <input
          id="bid-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm text-white"
        />
      </label>

      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="bid-status">
        Status
        <select
          id="bid-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm text-white"
        >
          {JOB_BID_STATUSES.map((s) => (
            <option key={s} value={s}>{bidStatusLabel(s)}</option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="bid-notes">
        Notes
        <textarea
          id="bid-notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this bid"
          rows={2}
          className="mt-1 block w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
        />
      </label>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Update bid" : "Save bid"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-full px-4 text-sm text-slate-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bid row (for history)
// ---------------------------------------------------------------------------

function BidHistoryRow({ bid }: { bid: JobBid }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-300">{formatCentsAsUsd(bid.amountCents)}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {new Date(bid.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <StatusBadge variant={bidStatusVariant(bid.status)}>
        {bidStatusLabel(bid.status)}
      </StatusBadge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface JobBidPanelProps {
  jobId: string;
}

export function JobBidPanel({ jobId }: JobBidPanelProps) {
  const { role } = useCurrentRole();
  const [bids, setBids] = useState<JobBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBid, setEditingBid] = useState<JobBid | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchBids = useCallback(async () => {
    try {
      const result = await requestJson<{ bids: JobBid[] }>(`/api/jobs/${jobId}/bids`, { role });
      setBids(result.bids);
    } catch {
      // Table may not exist yet; silently show empty state.
      setBids([]);
    } finally {
      setLoading(false);
    }
  }, [jobId, role]);

  useEffect(() => {
    void fetchBids();
  }, [fetchBids]);

  const currentBid = bids.find((b) => b.isCurrent) ?? null;
  const historyBids = bids.filter((b) => !b.isCurrent);
  const canEdit = role === "owner" || role === "manager" || role === "office";

  function handleSaved() {
    setShowForm(false);
    setEditingBid(null);
    void fetchBids();
  }

  function handleCancel() {
    setShowForm(false);
    setEditingBid(null);
  }

  if (loading) {
    return (
      <SurfaceCard>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white">Bid</h2>
          <p className="mt-2 text-sm text-slate-400">Loading...</p>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Bid</h2>
          </div>
          {canEdit && !showForm && !editingBid ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(true)}
              className="min-h-[44px] gap-1.5 text-sm text-slate-300 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {currentBid ? "New bid" : "Add bid"}
            </Button>
          ) : null}
        </div>

        {showForm || editingBid ? (
          <div className="mt-4">
            <BidForm
              jobId={jobId}
              role={role}
              initial={editingBid}
              onSaved={handleSaved}
              onCancel={handleCancel}
            />
          </div>
        ) : currentBid ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight text-white">
                {formatCentsAsUsd(currentBid.amountCents)}
              </p>
              <StatusBadge variant={bidStatusVariant(currentBid.status)}>
                {bidStatusLabel(currentBid.status)}
              </StatusBadge>
            </div>

            {currentBid.notes ? (
              <p className="text-sm text-slate-400">{currentBid.notes}</p>
            ) : null}

            {currentBid.fileId ? (
              <a
                href={`/api/jobs/${jobId}/files/${currentBid.fileId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                View attached file
              </a>
            ) : null}

            <p className="text-xs text-slate-500">
              Created{" "}
              {new Date(currentBid.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            {canEdit ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBid(currentBid)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No bid entered yet.</p>
        )}

        {historyBids.length > 0 ? (
          <div className="mt-4 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-300"
            >
              Previous bids ({historyBids.length})
              {showHistory ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showHistory ? (
              <div className="mt-2">
                {historyBids.map((bid) => (
                  <BidHistoryRow key={bid.id} bid={bid} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
