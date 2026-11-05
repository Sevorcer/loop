/**
 * Google Drive manuals sync — env-driven configuration (#33).
 *
 * Nothing talks to Google until ALL of these are set in Vercel:
 *
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL        e.g. loop-manuals@<project>.iam.gserviceaccount.com
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY  the "private_key" from the JSON key
 *                                             (literal "\n" escapes are fine)
 *   GOOGLE_DRIVE_MANUAL_FOLDER_IDS            comma-separated Drive folder ids shared
 *                                             with the service account as Viewer
 *
 * Values are never logged or returned — only the NAMES of missing vars.
 */

import type { DriveManualsConfigStatus } from "@/features/manuals/types/manuals";

export const DRIVE_ENV = {
  email: "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL",
  privateKey: "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY",
  folderIds: "GOOGLE_DRIVE_MANUAL_FOLDER_IDS",
} as const;

export interface DriveSyncConfig {
  serviceAccountEmail: string;
  privateKey: string;
  folderIds: string[];
}

type Env = Record<string, string | undefined>;

const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function parseFolderIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(/[\s,]+/)
    .map((v) => v.trim())
    // Accept a pasted folder URL as well as a bare id.
    .map((v) => v.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? v)
    .filter((v) => FOLDER_ID_RE.test(v));
  return [...new Set(ids)];
}

export function normalizePrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n").trim();
}

export function readDriveSyncConfig(env: Env = process.env): {
  config: DriveSyncConfig | null;
  status: DriveManualsConfigStatus;
} {
  const email = (env[DRIVE_ENV.email] ?? "").trim();
  const privateKey = normalizePrivateKey(env[DRIVE_ENV.privateKey]);
  const folderIds = parseFolderIds(env[DRIVE_ENV.folderIds]);

  const missing: string[] = [];
  if (!email || !email.includes("@")) missing.push(DRIVE_ENV.email);
  if (!privateKey.includes("PRIVATE KEY")) missing.push(DRIVE_ENV.privateKey);
  if (folderIds.length === 0) missing.push(DRIVE_ENV.folderIds);

  const status: DriveManualsConfigStatus = {
    configured: missing.length === 0,
    missing,
    folderCount: folderIds.length,
    serviceAccountEmail: email && email.includes("@") ? email : null,
  };

  return {
    config: status.configured ? { serviceAccountEmail: email, privateKey, folderIds } : null,
    status,
  };
}
