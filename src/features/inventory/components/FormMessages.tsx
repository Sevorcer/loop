interface MessageProps {
  message: string | null | undefined;
}

/** Server validation / network errors. */
export function FormError({ message }: MessageProps) {
  if (!message) return null;
  return (
    <p role="alert" className="status-danger rounded-atlas-md px-3 py-2 text-sm">
      {message}
    </p>
  );
}

/** Non-blocking caution (e.g. negative on-hand). Saving stays allowed. */
export function FormWarning({ message }: MessageProps) {
  if (!message) return null;
  return (
    <p role="status" className="status-warning rounded-atlas-md px-3 py-2 text-sm">
      {message}
    </p>
  );
}
