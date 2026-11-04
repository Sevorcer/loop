"use client";

import { Mail, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";

import { PermissionGuard, PhoneLink } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  ContactRole,
  CustomerContact,
  CustomerContactInput,
} from "../types/customerContact";
import { CONTACT_ROLES, CONTACT_ROLE_LABELS } from "../types/customerContact";

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

const ROLE_BADGE_CLASSES: Record<ContactRole, string> = {
  super: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  other: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function RoleBadge({ role }: { role: ContactRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[role] ?? ROLE_BADGE_CLASSES.other}`}
    >
      {CONTACT_ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Contact form (inline add/edit)
// ---------------------------------------------------------------------------

interface ContactFormProps {
  initial?: CustomerContactInput;
  onSubmit: (data: CustomerContactInput) => void;
  onCancel: () => void;
  submitting: boolean;
}

function ContactForm({ initial, onSubmit, onCancel, submitting }: ContactFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<ContactRole>(initial?.role ?? "other");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, role, phone, email });
  };

  const inputClass =
    "w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-default bg-muted/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-xs font-medium text-muted-foreground">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact-role" className="mb-1 block text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            id="contact-role"
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole)}
            className={inputClass}
          >
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>
                {CONTACT_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-phone" className="mb-1 block text-xs font-medium text-muted-foreground">
            Phone
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="contact-email" className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting} className="min-h-[36px]">
          {submitting ? "Saving..." : initial ? "Update" : "Add Contact"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="min-h-[36px]">
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CustomerContactsListProps {
  customerId: string;
  initialContacts: CustomerContact[];
}

export function CustomerContactsList({
  customerId,
  initialContacts,
}: CustomerContactsListProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>(initialContacts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = useCallback(
    async (data: CustomerContactInput) => {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/customers/${customerId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? "Failed to add contact.");
        }
        const { contact } = (await res.json()) as { contact: CustomerContact };
        setContacts((prev) => [...prev, contact]);
        setShowAddForm(false);
      } catch (err) {
        console.error("[CustomerContactsList] add failed", err);
      } finally {
        setSubmitting(false);
      }
    },
    [customerId],
  );

  const handleUpdate = useCallback(
    async (contactId: string, data: CustomerContactInput) => {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/customers/${customerId}/contacts/${contactId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? "Failed to update contact.");
        }
        const { contact } = (await res.json()) as { contact: CustomerContact };
        setContacts((prev) => prev.map((c) => (c.id === contactId ? contact : c)));
        setEditingId(null);
      } catch (err) {
        console.error("[CustomerContactsList] update failed", err);
      } finally {
        setSubmitting(false);
      }
    },
    [customerId],
  );

  const handleDelete = useCallback(
    async (contactId: string) => {
      try {
        const res = await fetch(`/api/customers/${customerId}/contacts/${contactId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? "Failed to delete contact.");
        }
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
      } catch (err) {
        console.error("[CustomerContactsList] delete failed", err);
      }
    },
    [customerId],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Contacts</CardTitle>
          <PermissionGuard table="customer_contacts" action="insert">
            {!showAddForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="min-h-[36px] gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </Button>
            ) : null}
          </PermissionGuard>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {showAddForm ? (
          <ContactForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitting={submitting}
          />
        ) : null}

        {contacts.length === 0 && !showAddForm ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No contacts recorded for this customer.
          </p>
        ) : null}

        {contacts.map((contact) =>
          editingId === contact.id ? (
            <ContactForm
              key={contact.id}
              initial={{
                name: contact.name,
                role: contact.role,
                phone: contact.phone,
                email: contact.email,
              }}
              onSubmit={(data) => handleUpdate(contact.id, data)}
              onCancel={() => setEditingId(null)}
              submitting={submitting}
            />
          ) : (
            <div
              key={contact.id}
              className="flex flex-col gap-2 rounded-xl border border-default bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-primary">
                    {contact.name || "Unnamed"}
                  </span>
                  <RoleBadge role={contact.role} />
                  {contact.isPrimary ? (
                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                      Primary
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {contact.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      <PhoneLink
                        phone={contact.phone}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      />
                    </span>
                  ) : null}
                  {contact.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {contact.email}
                      </a>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <PermissionGuard table="customer_contacts" action="update">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(contact.id)}
                    className="min-h-[36px] gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </PermissionGuard>

                <PermissionGuard table="customer_contacts" action="delete">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(contact.id)}
                    className="min-h-[36px] gap-1.5 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}
