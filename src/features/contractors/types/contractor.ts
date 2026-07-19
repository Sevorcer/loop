export type ContractorTrade =
  | "HVAC"
  | "Electrical"
  | "Plumbing"
  | "Roofing"
  | "General"
  | "Other";

export interface Contractor {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  trade: ContractorTrade | "";
  active: boolean;
  createdAt: string;
}

export interface CreateContractorInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  trade: ContractorTrade | "";
}
