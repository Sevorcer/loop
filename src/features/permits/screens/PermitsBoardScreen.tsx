"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileCheck } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState, LoadingState } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import type { PermitStatus } from "@/services/jobPermits";
interface Permit { id: string; jobId: string; jurisdiction: string; permitType: string; permitNumber: string | null; status: PermitStatus; notes: string | null; createdAt: string; updatedAt: string; }
const SO: PermitStatus[] = ["corrections_needed","waiting_on_city","intake_scheduled","applied","resubmitted","issued"];
const SL: Record<PermitStatus, string> = { applied: "Applied", intake_scheduled: "Intake Scheduled", corrections_needed: "Corrections Needed", resubmitted: "Resubmitted", waiting_on_city: "Waiting on City", issued: "Issued" };
const SI: Record<PermitStatus, "info"|"warning"|"success"|"danger"|"neutral"> = { applied: "info", intake_scheduled: "info", corrections_needed: "warning", resubmitted: "info", waiting_on_city: "warning", issued: "success" };
function dis(p: Permit): number { return Math.max(0, Math.floor((Date.now() - new Date(p.updatedAt || p.createdAt).getTime()) / 86400000)); }
function gbs(ps: Permit[]): Record<PermitStatus, Permit[]> { const g = {} as Record<PermitStatus, Permit[]>; for (const s of SO) g[s] = []; for (const p of ps) { if (g[p.status]) g[p.status].push(p); } for (const s of SO) g[s].sort((a, b) => dis(b) - dis(a)); return g; }
export function PermitsBoardScreen() {
  const [permits, setPermits] = useState<Permit[]>([]); const [loading, setLoading] = useState(true);
  const f = useCallback(async () => { try { const r = await fetch("/api/permits"); if (!r.ok) return; const j = (await r.json()) as { permits: Permit[] }; setPermits(j.permits ?? []); } finally { setLoading(false); } }, []);
  useEffect(() => { void f(); }, [f]);
  const grouped = useMemo(() => gbs(permits), [permits]);
  if (loading) return <div className="space-y-6 p-6"><PageHeader title="Permits Board" icon={FileCheck} /><LoadingState message="Loading permits..." /></div>;
  const totalOpen = permits.filter((p) => p.status !== "issued").length;
  return (<div className="space-y-6 p-6"><PageHeader title="Permits Board" icon={FileCheck} subtitle={`${totalOpen} open permit${totalOpen !== 1 ? "s" : ""}`} />{permits.length === 0 ? <EmptyState icon={FileCheck} title="No permits" description="Permits will appear here when created on jobs." /> : (<div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">{SO.filter((s) => s !== "issued").map((status) => { const group = grouped[status]; if (!group.length) return null; return (<SurfaceCard key={status}><div className="p-4"><div className="flex items-center justify-between mb-3"><StatusBadge label={SL[status]} intent={SI[status]} /><span className="text-xs text-muted">{group.length}</span></div><div className="space-y-2">{group.map((p) => { const d = dis(p); return (<div key={p.id} className="rounded-lg border border-border p-3 transition-colors hover:bg-surface-elevated/50"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium text-primary truncate">{p.jurisdiction} — {p.permitType}</p>{p.permitNumber && <p className="text-xs text-muted">#{p.permitNumber}</p>}</div><span className={`text-xs font-medium tabular-nums ${d > 7 ? "text-danger" : d > 3 ? "text-warning" : "text-muted"}`}>{d}d</span></div></div>); })}</div></div></SurfaceCard>); })}</div>)}{grouped.issued.length > 0 && <SurfaceCard><div className="p-4"><div className="flex items-center gap-2"><StatusBadge label="Issued" intent="success" /><span className="text-xs text-muted">{grouped.issued.length} issued</span></div></div></SurfaceCard>}</div>);
}
