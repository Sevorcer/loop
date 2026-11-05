"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, DollarSign, Plus, Trash2, X } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { formatCentsAsUsd } from "@/lib/money";
import type { ChangeOrderStatus } from "@/services/jobChangeOrders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangeOrder {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  status: ChangeOrderStatus;
  approvedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  declined: "Declined",
};

const STATUS_INTENT: Record<ChangeOrderStatus, "warning" | "success" | "neutral"> = {
  proposed: "warning",
  approved: "success",
  declined: "neutral",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JobChangeOrdersCardProps {
  jobId: string;
  canEdit: boolean;
  canDelete: boolean;
  priceCents?: number | null;
}

export function JobChangeOrdersCard({
  jobId,
  canEdit,
  canDelete,
  priceCents,
}: JobChangeOrdersCardProps) {
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`);
      if (!res.ok) return;
      const json = (await res.json()) as { changeOrders: ChangeOrder[] };
      setOrders(json.changeOrders);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const approvedTotal = orders
    .filter((co) => co.status === "approved")
    .reduce((sum, co) => sum + co.amountCents, 0);

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    // Parse dollar amount to cents
    const normalized = amount.trim().replace(/[$,\s]/g, "");
    const parsed = parseFloat(normalized || "0");
    if (isNaN(parsed) || parsed < 0) return;
    const cents = Math.round(parsed * 100);

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim(),
          amountCents: cents,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setAmount("");
        setShowForm(false);
        void load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (changeOrderId: string, action: "approve" | "decline") => {
    await fetch(`/api/jobs/${jobId}/change-orders`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changeOrderId, action }),
    });
    void load();
  };

  const handleDelete = async (changeOrderId: string) => {
    if (!window.confirm("Delete this change order?")) return;
    await fetch(`/api/jobs/${jobId}/change-orders`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changeOrderId }),
    });
    void load();
  };

  if (loading) return null;

  const combinedTotal =
    priceCents != null ? priceCents + approvedTotal : null;

  return (
    <SurfaceCard>
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Change Orders</h2>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px] gap-1.5 text-slate-300 hover:text-white"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>

        {/* Summary */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Approved COs
            </p>
            <p className="mt-1 text-base font-semibold text-emerald-400">
              {formatCentsAsUsd(approvedTotal)}
            </p>
          </div>
          {combinedTotal != null ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Price + Approved COs
              </p>
              <p className="mt-1 text-base font-semibold text-slate-100">
                {formatCentsAsUsd(combinedTotal)}
              </p>
            </div>
          ) : null}
        </div>

        {/* Inline form */}
        {showForm ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
            <input
              type="text"
              placeholder="Amount ($)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px]"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-[44px]"
                disabled={saving || !title.trim()}
                onClick={() => void handleCreate()}
              >
                {saving ? "Saving..." : "Add Change Order"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* List */}
        {orders.length === 0 && !showForm ? (
          <p className="text-sm text-slate-500">No change orders yet.</p>
        ) : null}

        {orders.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {orders.map((co) => (
              <li key={co.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      {co.title}
                    </p>
                    {co.description ? (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {co.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {formatCentsAsUsd(co.amountCents)}
                    </span>
                    <StatusBadge variant={STATUS_INTENT[co.status]}>
                      {STATUS_LABELS[co.status]}
                    </StatusBadge>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-2">
                  {canEdit && co.status === "proposed" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[36px] gap-1 px-2 text-xs text-emerald-400 hover:text-emerald-300"
                        onClick={() => void handleAction(co.id, "approve")}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[36px] gap-1 px-2 text-xs text-slate-400 hover:text-slate-300"
                        onClick={() => void handleAction(co.id, "decline")}
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-[36px] gap-1 px-2 text-xs text-red-400 hover:text-red-300"
                      onClick={() => void handleDelete(co.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
