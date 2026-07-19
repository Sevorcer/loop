let fallbackIdCounter = 0;

export function formatJobDate(value: string) {
  // Job dates are stored as calendar-only YYYY-MM-DD strings. Rendering them at
  // noon avoids UTC parsing shifts that can push the displayed date backward.
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

export function getTodayJobDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  fallbackIdCounter += 1;
  return `${prefix}-${Date.now()}-${fallbackIdCounter}`;
}
