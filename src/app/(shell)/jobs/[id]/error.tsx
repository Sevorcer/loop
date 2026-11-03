"use client";

import { ErrorState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

export default function JobDetailError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;

  return (
    <ErrorState
      title="Job detail unavailable"
      description="We couldn't load this job right now. Try again to restore its workspace, tasks, and activity."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
