"use client";

import { Mail, Phone, Shield } from "lucide-react";

import { usePortal } from "../state/PortalProvider";

/**
 * Contact Team screen — Sprint 22A MVP.
 *
 * Displays project manager, office, and emergency contacts.
 * Available to all MVP roles.
 */
export function ContactTeamScreen() {
  const { projection } = usePortal();
  const { contactTeam } = projection;

  const contacts = contactTeam?.contacts ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Project Team</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reach out directly with any questions about your project.
          </p>
        </div>

        <ul className="divide-y divide-border" aria-label="Project contacts">
          {contacts.map((contact) => (
            <li
              key={contact.role}
              className="flex items-start gap-4 px-5 py-4 sm:items-center"
            >
              {/* Avatar placeholder */}
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
              >
                <span className="text-sm font-semibold">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {contact.name}
                  </p>
                  <span className="hidden text-muted-foreground sm:block">·</span>
                  <p className="text-xs text-muted-foreground">{contact.role}</p>
                </div>

                <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone.replace(/\D/g, "")}`}
                      aria-label={`Call ${contact.name}`}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      aria-label={`Email ${contact.name}`}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {contact.email}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Preferred communication method note */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Preferred contact method</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            For the fastest response, call or text your Project Manager during
            business hours (Mon–Fri 7 AM–5 PM). For after-hours emergencies,
            use the 24/7 Emergency Line.
          </p>
        </div>
      </div>
    </div>
  );
}
