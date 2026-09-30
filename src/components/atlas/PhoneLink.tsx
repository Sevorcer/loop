/**
 * PhoneLink — F13 fix.
 *
 * Renders a phone number as a click-to-call tel: link. Non-dialable characters
 * are stripped from the href (keeping a leading +), while the display text is
 * left exactly as entered.
 */

interface PhoneLinkProps {
  phone: string;
  className?: string;
}

function toTelHref(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `tel:${hasPlus ? "+" : ""}${digits}`;
}

export function PhoneLink({ phone, className }: PhoneLinkProps) {
  const href = toTelHref(phone);
  if (!href) {
    return <span className={className}>{phone}</span>;
  }
  return (
    <a href={href} className={className} aria-label={`Call ${phone}`}>
      {phone}
    </a>
  );
}
