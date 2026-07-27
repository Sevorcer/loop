"use client";

import { ErrorState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

export default function CustomerDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Customer detail unavailable"
      description="We couldn't load this customer right now. Try again to restore timeline and account history."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
