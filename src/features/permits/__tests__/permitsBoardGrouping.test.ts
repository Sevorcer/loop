import { describe, expect, it } from "vitest";
type PS = "applied"|"intake_scheduled"|"corrections_needed"|"resubmitted"|"waiting_on_city"|"issued";
interface P { id: string; status: PS; updatedAt: string; createdAt: string; }
const SO: PS[] = ["corrections_needed","waiting_on_city","intake_scheduled","applied","resubmitted","issued"];
function dis(p: P): number { return Math.max(0, Math.floor((Date.now() - new Date(p.updatedAt||p.createdAt).getTime()) / 86400000)); }
function gbs(ps: P[]): Record<PS, P[]> { const g = {} as Record<PS, P[]>; for (const s of SO) g[s]=[]; for (const p of ps) { if(g[p.status]) g[p.status].push(p); } for (const s of SO) g[s].sort((a,b)=>dis(b)-dis(a)); return g; }
function mp(o: Partial<P>&{id:string;status:PS}): P { return {updatedAt:new Date().toISOString(),createdAt:new Date().toISOString(),...o}; }
function da(d: number): string { const r = new Date(); r.setDate(r.getDate()-d); return r.toISOString(); }
describe("permits board grouping", () => {
  it("groups by status", () => { const g=gbs([mp({id:"p1",status:"applied"}),mp({id:"p2",status:"corrections_needed"}),mp({id:"p3",status:"applied"}),mp({id:"p4",status:"issued"})]); expect(g.applied).toHaveLength(2); expect(g.corrections_needed).toHaveLength(1); expect(g.issued).toHaveLength(1); expect(g.waiting_on_city).toHaveLength(0); });
  it("stuck permits at top", () => { const g=gbs([mp({id:"r",status:"corrections_needed",updatedAt:da(1)}),mp({id:"s",status:"corrections_needed",updatedAt:da(10)}),mp({id:"f",status:"corrections_needed",updatedAt:new Date().toISOString()})]); expect(g.corrections_needed[0].id).toBe("s"); });
  it("stuck statuses first in order", () => { expect(SO.indexOf("corrections_needed")).toBeLessThan(SO.indexOf("applied")); expect(SO.indexOf("waiting_on_city")).toBeLessThan(SO.indexOf("applied")); });
  it("days-in-status", () => { const d=dis(mp({id:"p",status:"applied",updatedAt:da(5)})); expect(d).toBeGreaterThanOrEqual(4); expect(d).toBeLessThanOrEqual(6); });
});
