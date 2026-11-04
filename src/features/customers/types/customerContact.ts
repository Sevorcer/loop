/** Role a contact holds within the customer account. */
export type ContactRole = "super" | "pm" | "other";

export const CONTACT_ROLES: readonly ContactRole[] = ["super", "pm", "other"] as const;

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  super: "Super",
  pm: "PM",
  other: "Other",
};

/** Parse an untrusted value into a ContactRole, defaulting to "other". */
export function readContactRole(value: unknown): ContactRole {
  const raw = String(value ?? "other");
  return (CONTACT_ROLES as readonly string[]).includes(raw)
    ? (raw as ContactRole)
    : "other";
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  role: ContactRole;
  phone: string;
  email: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContactInput {
  name: string;
  role: ContactRole;
  phone: string;
  email: string;
}
