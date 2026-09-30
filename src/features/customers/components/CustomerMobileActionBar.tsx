import { MapPin, Phone } from "lucide-react";

import { toTelHref } from "@/components/atlas";
import { buildCustomerDirectionsUrl } from "@/features/jobs/utils/jobMobileActions";

import type { Customer } from "../types/customer";

interface CustomerMobileActionBarProps {
  customer: Customer;
}

/**
 * F14: sticky thumb-reach action bar for the phone field workflow — one tap
 * to call the customer or jump to directions. Pure anchor links, no client
 * JS. Renders only on small screens; desktop keeps the header actions.
 */
export function CustomerMobileActionBar({ customer }: CustomerMobileActionBarProps) {
  const callHref = toTelHref(customer.phone);
  const directionsUrl = buildCustomerDirectionsUrl(customer.street, customer.city, customer.zip);

  if (!callHref && !directionsUrl) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="flex items-stretch gap-2 p-3">
        {callHref ? (
          <a
            href={callHref}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500/90 to-blue-600 px-4 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            <Phone className="h-5 w-5" />
            Call {customer.primaryContact || "Customer"}
          </a>
        ) : null}
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Get directions to customer"
            className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-slate-200 transition active:scale-[0.98]"
          >
            <MapPin className="h-5 w-5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
