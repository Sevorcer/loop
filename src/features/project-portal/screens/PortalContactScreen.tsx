"use client";

import { Phone, Mail } from "lucide-react";

import { usePortal } from "../state/PortalProvider";
import { PortalEmptyState } from "../components/PortalErrorState";
import type { ContactRole, PortalContact } from "../types/portalTypes";

// ─── Contact Role Labels ──────────────────────────────────────────────────────

const ROLE_LABELS: Record<ContactRole, string> = {
  project_manager: "Project Manager",
  office: "Office",
  sales_rep: "Sales Representative",
  emergency: "Emergency Contact",
};

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact }: { contact: PortalContact }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:gap-6">
      {/* Avatar */}
      <div
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 text-lg font-semibold text-white"
      >
        {contact.name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white">{contact.name}</p>
        <p className="text-sm text-slate-400">{ROLE_LABELS[contact.role]}</p>
      </div>

      {/* Contact actions */}
      <div className="flex flex-wrap gap-2">
        {contact.phone ? (
          <a
            href={`tel:${contact.phone.replace(/\D/g, "")}`}
            aria-label={`Call ${contact.name}`}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Phone size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{contact.phone}</span>
            <span className="sm:hidden">Call</span>
          </a>
        ) : null}

        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            aria-label={`Email ${contact.name}`}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Mail size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{contact.email}</span>
            <span className="sm:hidden">Email</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PortalContactScreen() {
  const { contacts, permissions } = usePortal();

  if (!permissions?.canViewContact) {
    return (
      <PortalEmptyState
        heading="Contact information not available."
        body="Your account doesn't have access to the contact directory."
      />
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-white">Contact Team</h1>
        <PortalEmptyState
          heading="No contacts available."
          body="Contact information will appear here when configured by your contractor."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Contact Team</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reach your project team directly
        </p>
      </div>

      <section aria-label="Project contacts">
        <div className="space-y-3" role="list" aria-label="Contact list">
          {contacts.map((contact) => (
            <div key={contact.id} role="listitem">
              <ContactCard contact={contact} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
