/** Technicians do not manage the contractor list. Hide the create link for them. */
export function showAddContractorLink(role: string | null | undefined): boolean {
  return role !== "tech";
}
