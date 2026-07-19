let fallbackIdCounter = 0;

export function formatJobDate(value: string) {
  // Job dates are stored as calendar-only YYYY-MM-DD strings. Rendering them at
  // noon avoids UTC parsing shifts that can push the displayed date backward.
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

export function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  fallbackIdCounter += 1;
  return `${prefix}-${Date.now()}-${fallbackIdCounter}`;
}
