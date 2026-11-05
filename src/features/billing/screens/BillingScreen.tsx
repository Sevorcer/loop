"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader, SectionCard } from "@/components/atlas";
import { ReadyToBillTable } from "../components/ReadyToBillTable";
import type { ReadyToBillJob } from "../types/billing";

type BillingTab = "install" | "service";

async function fetchReadyToBill(type: BillingTab): Promise<ReadyToBillJob[]> {
  const res = await fetch(`/api/billing/ready-to-bill?type=${type}`);
  if (!res.ok) throw new Error("Failed to fetch billing data.");
  const data = await res.json();
  return data.jobs ?? [];
}

async function postBillingAction(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/billing/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Action failed.");
  }
}

export function BillingScreen() {
  const [activeTab, setActiveTab] = useState<BillingTab>("install");
  const [installJobs, setInstallJobs] = useState<ReadyToBillJob[]>([]);
  const [serviceJobs, setServiceJobs] = useState<ReadyToBillJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadJobs = useCallback(async (tab: BillingTab) => {
    setIsLoading(true);
    try {
      const jobs = await fetchReadyToBill(tab);
      if (tab === "install") setInstallJobs(jobs);
      else setServiceJobs(jobs);
    } catch {
      // Silently handle — empty list is shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs(activeTab);
  }, [activeTab, loadJobs]);

  const handleMarkBilled = useCallback(
    async (jobId: string, qbInvoiceNumber: string, billedAt: string) => {
      await postBillingAction({
        action: "mark_billed",
        jobId,
        qbInvoiceNumber,
        billedAt,
      });
      // Refresh the current tab
      await loadJobs(activeTab);
    },
    [activeTab, loadJobs],
  );

  const handleExclude = useCallback(
    async (jobId: string) => {
      await postBillingAction({
        action: "exclude",
        jobId,
      });
      await loadJobs(activeTab);
    },
    [activeTab, loadJobs],
  );

  const jobs = activeTab === "install" ? installJobs : serviceJobs;

  const tabs = [
    {
      value: "install" as const,
      label: `Install${installJobs.length > 0 ? ` (${installJobs.length})` : ""}`,
    },
    {
      value: "service" as const,
      label: `Service${serviceJobs.length > 0 ? ` (${serviceJobs.length})` : ""}`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ready to Bill"
        description="Jobs completed and awaiting billing. Mark each billed with a QuickBooks invoice number, or exclude jobs that don't need invoicing."
      />

      <SectionCard title="Completed Jobs">
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-white/10 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          <ReadyToBillTable
            jobs={jobs}
            onMarkBilled={handleMarkBilled}
            onExclude={handleExclude}
            isLoading={isLoading}
          />
        </div>
      </SectionCard>
    </div>
  );
}
