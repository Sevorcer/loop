"use client";

/**
 * GcPortalSubmitForm — Task 4 stub (included in Task 2 layout)
 *
 * Simple issue/request submission form for the builder portal.
 * Submits to POST /api/portal/[token]/submit.
 */

import { useState, useCallback } from "react";
import { Send, Loader2, CheckCircle } from "lucide-react";

interface GcPortalSubmitFormProps {
  token: string;
}

export function GcPortalSubmitForm({ token }: GcPortalSubmitFormProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !message.trim()) return;

      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch(`/api/portal/${token}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            contact: contact.trim(),
            message: message.trim(),
          }),
        });

        if (res.status === 429) {
          setError("Too many submissions. Please try again later.");
          return;
        }
        if (!res.ok) {
          setError("Failed to submit. Please try again.");
          return;
        }

        setSubmitted(true);
        setName("");
        setContact("");
        setMessage("");
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setSubmitting(false);
      }
    },
    [token, name, contact, message],
  );

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-8 text-center">
        <CheckCircle className="h-10 w-10 text-emerald-400" />
        <p className="text-sm font-medium text-foreground">
          Your submission has been received.
        </p>
        <p className="text-xs text-muted-foreground">
          The office will review it shortly.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-name" className="text-sm font-medium text-foreground">
          Name <span className="text-danger">*</span>
        </label>
        <input
          id="gc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Your name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-contact" className="text-sm font-medium text-foreground">
          Contact Info
        </label>
        <input
          id="gc-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Phone or email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-message" className="text-sm font-medium text-foreground">
          Message <span className="text-danger">*</span>
        </label>
        <textarea
          id="gc-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          placeholder="Describe the issue or request..."
        />
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim() || !message.trim()}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Submit
      </button>
    </form>
  );
}
