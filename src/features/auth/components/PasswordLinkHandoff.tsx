"use client";

import { useEffect } from "react";

import { passwordLinkHandoffHref } from "@/features/auth/lib/passwordLink";

/**
 * Invite and recovery emails often land on the site root. The root redirects
 * before any page can read the URL hash, and the hash is kept by the browser
 * across those redirects. This runs on whatever page finally loads and moves
 * that link onto the password page.
 */
export function PasswordLinkHandoff() {
  useEffect(() => {
    const href = passwordLinkHandoffHref(
      window.location.pathname,
      window.location.hash,
      window.location.search,
    );
    if (href) window.location.replace(href);
  }, []);

  return null;
}
