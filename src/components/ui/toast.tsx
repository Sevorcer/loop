"use client";

import { useEffect, useState } from "react";

type ToastTone = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type Listener = (toast: ToastItem) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function pushToast(message: string, tone: ToastTone = "success") {
  const toast = { id: nextId++, message, tone };
  for (const listener of listeners) {
    listener(toast);
  }
}

/**
 * Lightweight status toast. Mount once in the app shell.
 * Callers use `pushToast` so server-action buttons do not need a provider.
 */
export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <p
          key={toast.id}
          role="status"
          className={
            toast.tone === "error"
              ? "pointer-events-auto max-w-md rounded-xl border border-red-500/40 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-lg"
              : "pointer-events-auto max-w-md rounded-xl border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-sm text-emerald-100 shadow-lg"
          }
        >
          {toast.message}
        </p>
      ))}
    </div>
  );
}
