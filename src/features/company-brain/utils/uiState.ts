export type CompanyBrainUiState = "loading" | "error" | "empty" | "ready";

export function resolveCompanyBrainUiState(input: {
  loading: boolean;
  error: string | null;
  itemCount: number;
}): CompanyBrainUiState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.itemCount === 0) return "empty";
  return "ready";
}
