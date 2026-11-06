/** Parses a typed quantity ("3", "-2.5") into a number with at most 3 decimals. Blank/invalid -> undefined. */
export function parseQuantity(input: string): number | undefined {
  const cleaned = input.trim();
  if (!/^-?\d+(\.\d{1,3})?$/.test(cleaned)) return undefined;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}
