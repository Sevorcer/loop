import type {
  ExpectedArrivalInput,
  JobReadiness,
  LineReadiness,
  MaterialReadinessLevel,
  ReadinessInput,
  ReadinessJobInput,
  ReadinessLineInput,
} from "../types/readiness";

// Pure readiness engine (plan §3.3). No I/O: the service loads the inputs, calls
// computeReadiness, and caches the result. Everything here is unit-tested.

const SEVERITY: Record<MaterialReadinessLevel, number> = {
  ok: 0,
  arriving_in_time: 1,
  short: 2,
  at_risk: 3,
};

/** The worse of two levels (at_risk > short > arriving_in_time > ok). */
export function worstReadiness(
  a: MaterialReadinessLevel | null,
  b: MaterialReadinessLevel | null,
): MaterialReadinessLevel | null {
  if (a === null) return b;
  if (b === null) return a;
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

// -- Date-only math (no time zones: inputs are already company-local dates) --

function dayNumber(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" -> "Nov 14". */
export function shortDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}`;
}

/** 2 -> "2", 1.5 -> "1.5", 1.2500 -> "1.25". */
export function formatQty(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function isChecked(line: ReadinessLineInput): boolean {
  return !line.isOptional && line.nonStockReason === null && line.required > 0;
}

interface ArrivalPool {
  id: string;
  itemId: string;
  forJobId: string | null;
  etaDate: string;
  remaining: number;
}

function buildArrivalPools(arrivals: ExpectedArrivalInput[]): ArrivalPool[] {
  return arrivals
    .filter((arrival) => arrival.qty > 0)
    .map((arrival) => ({
      id: arrival.id,
      itemId: arrival.itemId,
      forJobId: arrival.forJobId,
      etaDate: arrival.etaDate,
      remaining: arrival.qty,
    }))
    .sort((a, b) => (a.etaDate === b.etaDate ? a.id.localeCompare(b.id) : a.etaDate.localeCompare(b.etaDate)));
}

interface Coverage {
  covered: number;
  latestEta: string | null;
}

/** Take up to `need` from the arrivals that land in time for this job. */
function takeInTimeArrivals(
  pools: ArrivalPool[],
  itemId: string,
  jobId: string,
  cutoff: string,
  need: number,
): Coverage {
  let covered = 0;
  let latestEta: string | null = null;
  // A special order for this job is used first, then general arrivals.
  const ordered = [
    ...pools.filter((pool) => pool.itemId === itemId && pool.forJobId === jobId),
    ...pools.filter((pool) => pool.itemId === itemId && pool.forJobId === null),
  ];
  for (const pool of ordered) {
    if (covered >= need) break;
    if (pool.remaining <= 0 || pool.etaDate > cutoff) continue;
    const take = Math.min(pool.remaining, need - covered);
    pool.remaining -= take;
    covered += take;
    if (latestEta === null || pool.etaDate > latestEta) latestEta = pool.etaDate;
  }
  return { covered, latestEta };
}

/** Earliest arrival for this item that is still unclaimed (it lands too late). */
function earliestLateArrival(pools: ArrivalPool[], itemId: string, jobId: string): string | null {
  const late = pools.find(
    (pool) =>
      pool.itemId === itemId &&
      pool.remaining > 0 &&
      (pool.forJobId === null || pool.forJobId === jobId),
  );
  return late ? late.etaDate : null;
}

function excludedLine(line: ReadinessLineInput): LineReadiness {
  return { lineId: line.lineId, state: null, reason: null, eta: null, shortfall: 0, unverified: false, excluded: true };
}

function checkLine(
  line: ReadinessLineInput,
  job: ReadinessJobInput & { scheduledDate: string },
  input: ReadinessInput,
  pools: ArrivalPool[],
  freeStock: Map<string, number>,
): LineReadiness {
  const base = { lineId: line.lineId, shortfall: 0, unverified: false, excluded: false };

  // Needs SKU: cannot be checked, reported as unverified.
  if (line.itemId === null) {
    return { ...base, state: null, reason: `${line.name} needs a catalog item`, eta: null, unverified: true };
  }

  const shortfall = Math.max(line.required - line.reserved - line.pulled, 0);
  if (shortfall <= 0) return { ...base, state: "ok", reason: null, eta: null };

  // Unclaimed shop stock covers a shortfall first (a draft plan, or stock that
  // arrived since the last reservation run).
  const free = freeStock.get(line.itemId) ?? 0;
  const fromStock = Math.min(free, shortfall);
  if (fromStock > 0) freeStock.set(line.itemId, free - fromStock);
  let remaining = shortfall - fromStock;
  if (remaining <= 0) return { ...base, state: "ok", reason: null, eta: null };

  const cutoff = shiftDate(job.scheduledDate, -input.settings.bufferDays);
  const inTime = takeInTimeArrivals(pools, line.itemId, job.jobId, cutoff, remaining);
  remaining -= inTime.covered;

  if (remaining <= 0) {
    return {
      ...base,
      shortfall,
      state: "arriving_in_time",
      reason: `${line.name}: arriving ${shortDate(inTime.latestEta ?? job.scheduledDate)}`,
      eta: inTime.latestEta,
    };
  }

  const lateEta = earliestLateArrival(pools, line.itemId, job.jobId);
  if (lateEta !== null) {
    return {
      ...base,
      shortfall: remaining,
      state: "at_risk",
      reason: `Short ${formatQty(remaining)} ${line.name} — ETA ${shortDate(lateEta)} ${
        lateEta > job.scheduledDate ? "is after the job date" : "is too close to the job date"
      }`,
      eta: lateEta,
    };
  }

  const daysOut = daysBetween(input.today, job.scheduledDate);
  if (daysOut <= input.settings.leadDays) {
    const when = daysOut <= 0 ? "job is today or overdue" : `job in ${daysOut} ${daysOut === 1 ? "day" : "days"}`;
    return {
      ...base,
      shortfall: remaining,
      state: "at_risk",
      reason: `Short ${formatQty(remaining)} ${line.name} — not ordered, ${when}`,
      eta: null,
    };
  }
  return {
    ...base,
    shortfall: remaining,
    state: "short",
    reason: `Short ${formatQty(remaining)} ${line.name} — not yet ordered`,
    eta: null,
  };
}

/** "YYYY-MM-DD" plus whole days. */
export function shiftDate(date: string, days: number): string {
  const next = new Date((dayNumber(date) + days) * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function emptyJob(job: ReadinessJobInput): JobReadiness {
  return {
    jobId: job.jobId,
    rollup: null,
    reason: null,
    eta: null,
    lines: job.lines.map(excludedLine),
    counts: { total: 0, ok: 0, arriving: 0, short: 0, atRisk: 0, needsSku: 0 },
  };
}

/**
 * Readiness for every job in the input. Jobs are served in date order so one
 * delivery or pile of free stock is never counted for two jobs.
 */
export function computeReadiness(input: ReadinessInput): Map<string, JobReadiness> {
  const results = new Map<string, JobReadiness>();
  const pools = buildArrivalPools(input.arrivals);
  const freeStock = new Map<string, number>(Object.entries(input.freeStock));

  const checked: Array<ReadinessJobInput & { scheduledDate: string }> = [];
  for (const job of input.jobs) {
    if (!job.active || job.scheduledDate === null || Number.isNaN(dayNumber(job.scheduledDate))) {
      results.set(job.jobId, emptyJob(job));
    } else {
      checked.push({ ...job, scheduledDate: job.scheduledDate });
    }
  }
  checked.sort((a, b) =>
    a.scheduledDate === b.scheduledDate ? a.jobId.localeCompare(b.jobId) : a.scheduledDate.localeCompare(b.scheduledDate),
  );

  for (const job of checked) {
    const lines: LineReadiness[] = job.lines.map((line) =>
      isChecked(line) && (line.itemId === null || line.itemStockable)
        ? checkLine(line, job, input, pools, freeStock)
        : excludedLine(line),
    );

    const counts = { total: 0, ok: 0, arriving: 0, short: 0, atRisk: 0, needsSku: 0 };
    let rollup: MaterialReadinessLevel | null = null;
    for (const line of lines) {
      if (line.excluded) continue;
      counts.total += 1;
      if (line.unverified) counts.needsSku += 1;
      if (line.state === "ok") counts.ok += 1;
      if (line.state === "arriving_in_time") counts.arriving += 1;
      if (line.state === "short") counts.short += 1;
      if (line.state === "at_risk") counts.atRisk += 1;
      rollup = worstReadiness(rollup, line.state);
    }
    // A job with nothing to check is simply ready.
    if (rollup === null) rollup = "ok";

    const worst = lines.filter((line) => line.state === rollup && line.reason !== null);
    const first = worst[0];
    const more = worst.length - 1;
    let reason: string | null = first?.reason ?? null;
    if (reason !== null && more > 0) reason = `${reason} (+${more} more)`;
    if (reason === null && counts.needsSku > 0) {
      reason = `${counts.needsSku} ${counts.needsSku === 1 ? "line needs" : "lines need"} a catalog item`;
    }

    results.set(job.jobId, {
      jobId: job.jobId,
      rollup,
      reason,
      eta: first?.eta ?? null,
      lines,
      counts,
    });
  }

  return results;
}

/** Dispatch board mapping (plan §3.3). Unverified (needs-SKU) lines lift ok to attention. */
export function toDispatchReadiness(
  rollup: MaterialReadinessLevel | null,
  needsSku: number,
): "satisfied" | "attention_needed" | "not_satisfied" {
  if (rollup === "at_risk") return "not_satisfied";
  if (rollup === "short" || rollup === "arriving_in_time" || needsSku > 0) return "attention_needed";
  return "satisfied";
}
