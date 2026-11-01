/**
 * Service Fusion sends dollars, sometimes with more than two decimal places.
 * Loop stores integer cents. Half rounds away from zero.
 */
export function dollarsToCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return dollarsToCents(value.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""));
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = match[3] ?? "";
  const padded = `${fraction}000`;
  const cents = Number(padded.slice(0, 2));
  const roundUp = Number(padded[2] ?? "0") >= 5;
  const total = whole * 100 + cents + (roundUp ? 1 : 0);
  if (!Number.isSafeInteger(total)) return null;
  return sign * total;
}
