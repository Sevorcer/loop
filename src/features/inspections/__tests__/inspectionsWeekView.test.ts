import { describe, expect, it } from "vitest";
type IR = "scheduled"|"passed"|"failed"|"partial"|"rescheduled_by_city";
interface I { id: string; scheduledDate: string|null; result: IR; }
function sow(d:Date):Date{const r=new Date(d);r.setDate(r.getDate()-r.getDay());r.setHours(0,0,0,0);return r;}
function eow(d:Date):Date{const r=sow(d);r.setDate(r.getDate()+6);r.setHours(23,59,59,999);return r;}
function itw(ds:string|null,n:Date):boolean{if(!ds)return false;const d=new Date(ds);return d>=sow(n)&&d<=eow(n);}
function ibt(ds:string|null,n:Date):boolean{if(!ds)return false;const d=new Date(ds);const t=new Date(n);t.setHours(0,0,0,0);return d<t;}
function isy(ds:string|null,n:Date):boolean{if(!ds)return false;const d=new Date(ds);const y=new Date(n);y.setDate(y.getDate()-1);return d.getFullYear()===y.getFullYear()&&d.getMonth()===y.getMonth()&&d.getDate()===y.getDate();}
function gwi(ii:I[],n:Date):I[]{return ii.filter(i=>itw(i.scheduledDate,n)).sort((a,b)=>(a.scheduledDate??"").localeCompare(b.scheduledDate??""));}
function gar(ii:I[],n:Date):I[]{return ii.filter(i=>i.result==="scheduled"&&i.scheduledDate&&ibt(i.scheduledDate,n)).sort((a,b)=>{const ay=isy(a.scheduledDate,n);const by_=isy(b.scheduledDate,n);if(ay&&!by_)return -1;if(!ay&&by_)return 1;return(b.scheduledDate??"").localeCompare(a.scheduledDate??"");});}
const NOW=new Date("2026-11-04T12:00:00Z");
function ds(y:number,m:number,d:number):string{return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
describe("week view", () => {
  it("includes this week only", () => { const w=gwi([{id:"i1",scheduledDate:ds(2026,11,2),result:"scheduled"},{id:"i2",scheduledDate:ds(2026,11,6),result:"scheduled"},{id:"i3",scheduledDate:ds(2026,11,10),result:"scheduled"},{id:"i4",scheduledDate:ds(2026,10,28),result:"scheduled"}],NOW); expect(w.map(i=>i.id)).toContain("i1"); expect(w.map(i=>i.id)).toContain("i2"); expect(w.map(i=>i.id)).not.toContain("i3"); });
  it("sorts ascending", () => { const w=gwi([{id:"f",scheduledDate:ds(2026,11,6),result:"scheduled"},{id:"m",scheduledDate:ds(2026,11,2),result:"scheduled"},{id:"w",scheduledDate:ds(2026,11,4),result:"scheduled"}],NOW); expect(w.map(i=>i.id)).toEqual(["m","w","f"]); });
});
describe("awaiting result", () => {
  it("only past-date scheduled", () => { const a=gar([{id:"ps",scheduledDate:ds(2026,11,2),result:"scheduled"},{id:"pp",scheduledDate:ds(2026,11,2),result:"passed"},{id:"fu",scheduledDate:ds(2026,11,10),result:"scheduled"}],NOW); expect(a.map(i=>i.id)).toContain("ps"); expect(a.map(i=>i.id)).not.toContain("pp"); expect(a.map(i=>i.id)).not.toContain("fu"); });
  it("yesterday first", () => { const a=gar([{id:"3d",scheduledDate:ds(2026,11,1),result:"scheduled"},{id:"y",scheduledDate:ds(2026,11,3),result:"scheduled"},{id:"2d",scheduledDate:ds(2026,11,2),result:"scheduled"}],NOW); expect(a[0].id).toBe("y"); });
  it("then most recent first", () => { const a=gar([{id:"o",scheduledDate:ds(2026,10,28),result:"scheduled"},{id:"n",scheduledDate:ds(2026,11,1),result:"scheduled"},{id:"r",scheduledDate:ds(2026,11,2),result:"scheduled"}],NOW); expect(a.map(i=>i.id)).toEqual(["r","n","o"]); });
});
