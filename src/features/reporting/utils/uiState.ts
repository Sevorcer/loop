export type ReportingUiState = "loading" | "error" | "empty" | "ready";

export function resolveReportingUiState(input: {
  loading: boolean;
  error: string | null;
  modelCount: number;
}): ReportingUiState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.modelCount === 0) return "empty";
  return "ready";
}
