"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { SectionCard } from "@/components/atlas/SectionCard";
import { pushToast } from "@/components/ui/toast";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

type Visibility = "owner" | "owner_manager" | "revenue_roles";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  {
    value: "owner",
    label: "Owner only",
    hint: "Financial detail and revenue totals are visible only to the owner account.",
  },
  {
    value: "owner_manager",
    label: "Owner + Manager",
    hint: "Managers can also see financial detail and revenue totals.",
  },
  {
    value: "revenue_roles",
    label: "Revenue roles (legacy)",
    hint: "Owner, manager, dispatch, office, and sales — the pre-2026-11-04 behavior.",
  },
];

/**
 * Financial visibility setting (Collin, 2026-11-04). Owner-only: renders
 * nothing for every other role, and the API enforces the same rule.
 */
export function FinancialVisibilityCard() {
  const { role } = useCurrentRole();
  const [value, setValue] = useState<Visibility | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    async function load() {
      try {
        const data = await requestJson<{ visibility: Visibility }>(
          "/api/settings/financial-visibility",
        );
        if (!cancelled) setValue(data.visibility);
      } catch {
        if (!cancelled) setValue("owner");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (role !== "owner" || value === null) return null;

  async function choose(next: Visibility) {
    if (next === value || saving) return;
    setSaving(true);
    try {
      const data = await requestJson<{ visibility: Visibility }>(
        "/api/settings/financial-visibility",
        { method: "PUT", body: JSON.stringify({ visibility: next }) },
      );
      setValue(data.visibility);
      pushToast("Financial visibility updated.");
    } catch {
      pushToast("Could not update financial visibility.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Financial Visibility"
      description="Who can see job financial detail and revenue totals. Only the owner can change this."
    >
      <div className="space-y-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              value === option.value
                ? "border-blue-500/30 bg-blue-500/5"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700",
            ].join(" ")}
          >
            <input
              type="radio"
              name="financial-visibility"
              className="mt-0.5"
              checked={value === option.value}
              disabled={saving}
              onChange={() => void choose(option.value)}
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                {option.value === "owner" ? <Lock size={13} /> : null}
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}
