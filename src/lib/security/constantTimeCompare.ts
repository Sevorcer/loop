/**
 * Constant-time string comparison using Node.js crypto.timingSafeEqual.
 *
 * Prevents timing-based side-channel attacks when comparing secrets
 * (e.g. bearer tokens, share-link tokens, portal tokens).
 *
 * Returns `false` for empty or mismatched-length strings without leaking
 * length information beyond "they differ".
 */

import { timingSafeEqual } from "crypto";

/**
 * Compare two strings in constant time.
 *
 * - Returns `false` immediately if either string is empty (no secret to compare).
 * - When lengths differ the shorter string is padded so `timingSafeEqual` still
 *   runs in constant time relative to the longer input.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;

  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");

  // timingSafeEqual requires equal-length buffers.
  // Pad the shorter one so the comparison doesn't leak length via early-return.
  if (bufA.length !== bufB.length) {
    const maxLen = Math.max(bufA.length, bufB.length);
    const paddedA = Buffer.alloc(maxLen);
    const paddedB = Buffer.alloc(maxLen);
    bufA.copy(paddedA);
    bufB.copy(paddedB);
    // Always run the comparison, but the result is guaranteed false
    // when the original lengths differ.
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
