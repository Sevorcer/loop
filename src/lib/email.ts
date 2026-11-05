/**
 * Outbound email via Resend (live-review #35, 2026-11-04).
 *
 * Key-optional by design: when RESEND_API_KEY is not configured the send
 * is a no-op that reports `not_configured`, so the feature can ship and
 * be toggled in the UI before the account/DNS setup exists. Sending
 * NEVER throws — callers treat email as a side effect, not a gate.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Legacy One Heating <notifications@legacyoneheating.net>";

export interface EmailSendResult {
  sent: boolean;
  reason?: "not_configured" | "no_recipient" | "provider_error";
  providerId?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "not_configured" };
  }

  const to = input.to.trim();
  if (!to) {
    return { sent: false, reason: "no_recipient" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
        to: [to],
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: "provider_error" };
    }

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    return { sent: true, providerId: payload?.id };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}
