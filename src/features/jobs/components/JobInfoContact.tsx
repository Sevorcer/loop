"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, User } from "lucide-react";

import {
  CONTACT_ROLE_LABELS,
  type CustomerContact,
} from "@/features/customers/types/customerContact";

/**
 * Contact block for the Job Info card on Job Detail: the customer's
 * contacts with tap-to-call / tap-to-email links so the crew can reach
 * the customer without leaving the job. The contacts API returns
 * primary-first. Renders nothing while loading, when the customer has
 * no contacts, or when the read fails — the full contacts list lives
 * on the customer page.
 */
export function JobInfoContact({ customerId }: { customerId: string }) {
  const [contacts, setContacts] = useState<CustomerContact[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}/contacts`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("contacts read failed");
        const data = (await res.json()) as { contacts?: CustomerContact[] };
        if (!cancelled) setContacts(data.contacts ?? []);
      } catch {
        if (!cancelled) setContacts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (!contacts || contacts.length === 0) return null;

  return (
    <div className="flex items-start gap-3" data-testid="job-info-contact">
      <User className="mt-0.5 h-4 w-4 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
          {contacts.length > 1 ? "Contacts" : "Contact"}
        </p>
        <div className="mt-0.5 space-y-2">
          {contacts.map((contact) => (
            <div key={contact.id} className="min-w-0">
              <p className="text-xs text-slate-200 sm:text-sm">
                {contact.name}
                <span className="text-slate-400">
                  {" "}
                  · {CONTACT_ROLE_LABELS[contact.role]}
                  {contact.isPrimary ? " · Primary" : ""}
                </span>
              </p>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="mt-0.5 flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 hover:underline sm:text-sm"
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  {contact.phone}
                </a>
              ) : null}
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="mt-0.5 flex items-center gap-1 break-all text-xs text-blue-300 hover:text-blue-200 hover:underline sm:text-sm"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  {contact.email}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
