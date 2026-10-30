const MAX_CENTS = 100_000_000_00;

export function formatCentsAsUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export type PriceParseResult =
  | { ok: true; cents: number | null }
  | { ok: false; message: string };

/**
 * Accepts a blank value (clears the price) or a non-negative dollar amount
 * with at most two decimal places. "$1,200.50" and "1200.5" are both valid.
 */
export function parseDollarsToCents(value: string): PriceParseResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, cents: null };
  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, message: "Invalid price. Use dollars and cents, like 1200.50." };
  }
  const [dollars, fraction = ""] = normalized.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    return { ok: false, message: "Invalid price. Enter a non-negative amount up to $100,000,000." };
  }
  return { ok: true, cents };
}
