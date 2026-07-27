"use client";

import { ErrorState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

export default function PropertyDetailError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;

  return (
    <ErrorState
      title="Property detail unavailable"
      description="We couldn't load this property right now. Try again to recover service history and timeline context."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
