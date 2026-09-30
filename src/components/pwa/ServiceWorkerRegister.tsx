"use client";

import { useEffect } from "react";

/**
 * Registers the LOOP service worker (installability + app-shell caching).
 * Enhancement-only: a failed registration must never break the app.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Service workers are best-effort; the app works fine without one.
        });
      };
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
      }
    }
  }, []);

  return null;
}
