import "server-only";

/**
 * Minimal read-only Google Drive client for the manuals index (#33).
 *
 * - Auth: service-account JWT (RS256, node:crypto) exchanged for an access
 *   token. No googleapis dependency.
 * - Scope: drive.metadata.readonly — Loop can list names / links / dates but
 *   cannot read, download, change, move, share or delete any file.
 * - Walks each configured folder (and its subfolders) and returns file
 *   metadata with a "Folder / Subfolder" path. Shortcuts are resolved to
 *   their target when the target is visible to the service account.
 */

import { createSign } from "node:crypto";

import type { DriveListedFile } from "@/features/manuals/types/manuals";
import { DriveSyncError } from "@/features/manuals/utils/manualErrors";

export { DriveSyncError };

import type { DriveSyncConfig } from "./driveConfig";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

export const DRIVE_LIMITS = { maxFolders: 300, maxFiles: 5000, maxDepth: 8 } as const;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function buildServiceAccountJwt(config: DriveSyncConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.serviceAccountEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(config.privateKey));
  return `${header}.${claims}.${signature}`;
}

export async function getDriveAccessToken(config: DriveSyncConfig, fetchImpl: FetchLike = fetch): Promise<string> {
  let assertion: string;
  try {
    assertion = buildServiceAccountJwt(config);
  } catch {
    throw new DriveSyncError("The Google service account private key could not be read. Re-paste it in Vercel.", 500);
  }
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new DriveSyncError(`Google rejected the service account sign-in (HTTP ${res.status}).`, 502);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new DriveSyncError("Google did not return an access token.", 502);
  return body.access_token;
}

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

async function driveGet<T>(token: string, url: string, fetchImpl: FetchLike): Promise<T> {
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) throw new DriveSyncError("A configured Drive folder was not found or is not shared with the service account.", 404);
  if (res.status === 403) throw new DriveSyncError("The service account does not have access to a configured Drive folder.", 403);
  if (!res.ok) throw new DriveSyncError(`Google Drive returned HTTP ${res.status}.`, 502);
  return (await res.json()) as T;
}

const FILE_FIELDS = "id,name,mimeType,modifiedTime,webViewLink,size,parents,shortcutDetails";

async function listChildren(token: string, folderId: string, fetchImpl: FetchLike): Promise<DriveApiFile[]> {
  const out: DriveApiFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      orderBy: "name",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await driveGet<{ files?: DriveApiFile[]; nextPageToken?: string }>(
      token,
      `${FILES_URL}?${params.toString()}`,
      fetchImpl,
    );
    out.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

async function getFile(token: string, fileId: string, fetchImpl: FetchLike): Promise<DriveApiFile | null> {
  const params = new URLSearchParams({ fields: FILE_FIELDS, supportsAllDrives: "true" });
  try {
    return await driveGet<DriveApiFile>(token, `${FILES_URL}/${encodeURIComponent(fileId)}?${params}`, fetchImpl);
  } catch (error) {
    if (error instanceof DriveSyncError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

function toListed(file: DriveApiFile, folderPath: string, rootFolderId: string, parentFolderId: string): DriveListedFile {
  const size = file.size ? Number(file.size) : null;
  return {
    driveFileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    folderPath,
    rootFolderId,
    parentFolderId,
    modifiedTime: file.modifiedTime ?? null,
    webViewLink: file.webViewLink?.startsWith("https://") ? file.webViewLink : "",
    sizeBytes: size !== null && Number.isFinite(size) ? size : null,
  };
}

export interface DriveTreeResult {
  files: DriveListedFile[];
  foldersVisited: number;
  truncated: boolean;
}

/** Breadth-first walk of every configured root folder. */
export async function listManualFolderTree(
  config: DriveSyncConfig,
  options: { fetchImpl?: FetchLike; token?: string } = {},
): Promise<DriveTreeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token ?? (await getDriveAccessToken(config, fetchImpl));

  const files = new Map<string, DriveListedFile>();
  const seenFolders = new Set<string>();
  let truncated = false;

  for (const rootId of config.folderIds) {
    const root = await getFile(token, rootId, fetchImpl);
    if (!root) {
      throw new DriveSyncError(`Drive folder ${rootId} is not shared with the service account.`, 403);
    }
    const queue: Array<{ id: string; path: string; depth: number }> = [{ id: rootId, path: root.name, depth: 0 }];
    while (queue.length > 0) {
      const folder = queue.shift()!;
      if (seenFolders.has(folder.id)) continue;
      if (seenFolders.size >= DRIVE_LIMITS.maxFolders) {
        truncated = true;
        break;
      }
      seenFolders.add(folder.id);
      const children = await listChildren(token, folder.id, fetchImpl);
      for (const child of children) {
        if (child.mimeType === FOLDER_MIME) {
          if (folder.depth + 1 <= DRIVE_LIMITS.maxDepth) {
            queue.push({ id: child.id, path: `${folder.path} / ${child.name}`, depth: folder.depth + 1 });
          } else {
            truncated = true;
          }
          continue;
        }
        let target = child;
        if (child.mimeType === SHORTCUT_MIME) {
          const targetId = child.shortcutDetails?.targetId;
          if (!targetId || child.shortcutDetails?.targetMimeType === FOLDER_MIME) continue;
          const resolved = await getFile(token, targetId, fetchImpl);
          if (!resolved) continue; // target not shared with the service account
          target = { ...resolved, name: resolved.name || child.name };
        }
        if (files.has(target.id)) continue;
        if (files.size >= DRIVE_LIMITS.maxFiles) {
          truncated = true;
          break;
        }
        files.set(target.id, toListed(target, folder.path, rootId, folder.id));
      }
    }
  }

  return { files: [...files.values()], foldersVisited: seenFolders.size, truncated };
}
