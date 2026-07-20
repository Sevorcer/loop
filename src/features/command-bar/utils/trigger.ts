export type TriggerLayout = "mobile" | "desktop";

export function getTriggerLayout(viewportWidth: number): TriggerLayout {
  return viewportWidth < 640 ? "mobile" : "desktop";
}
