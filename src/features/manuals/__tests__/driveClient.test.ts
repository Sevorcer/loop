import { generateKeyPairSync, createVerify } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildServiceAccountJwt, DRIVE_SCOPE, getDriveAccessToken, listManualFolderTree } from "@/lib/manuals/driveClient";
import { DriveSyncError } from "@/features/manuals/utils/manualErrors";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = {
  serviceAccountEmail: "loop@proj.iam.gserviceaccount.com",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  folderIds: ["ROOTFOLDER01"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildServiceAccountJwt", () => {
  it("signs an RS256 JWT with the read-only metadata scope", () => {
    const jwt = buildServiceAccountJwt(config, 1_000_000);
    const [h, c, s] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims).toMatchObject({ iss: config.serviceAccountEmail, scope: DRIVE_SCOPE, exp: 1_003_600 });
    expect(DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.metadata.readonly");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("getDriveAccessToken", () => {
  it("exchanges the JWT for a token", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "tok" }));
    await expect(getDriveAccessToken(config, fetchImpl)).resolves.toBe("tok");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(String(init.body)).toContain("grant_type=urn");
  });

  it("raises a DriveSyncError when Google refuses", async () => {
    await expect(getDriveAccessToken(config, async () => json({}, 401))).rejects.toBeInstanceOf(DriveSyncError);
  });

  it("raises a clear error for an unreadable key", async () => {
    await expect(getDriveAccessToken({ ...config, privateKey: "nope" }, async () => json({}))).rejects.toThrow(
      /private key/,
    );
  });
});

describe("listManualFolderTree", () => {
  function driveFake(tree: Record<string, { name: string; children?: unknown[] }>, files: Record<string, unknown> = {}) {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string) => {
      calls.push(input);
      const url = new URL(input);
      const id = decodeURIComponent(url.pathname.split("/files/")[1] ?? "");
      if (id) {
        if (tree[id]) return json({ id, name: tree[id].name, mimeType: "application/vnd.google-apps.folder" });
        if (files[id]) return json(files[id]);
        return json({}, 404);
      }
      const q = url.searchParams.get("q") ?? "";
      const parent = q.match(/'([^']+)' in parents/)?.[1] ?? "";
      const children = tree[parent]?.children ?? [];
      const token = url.searchParams.get("pageToken");
      // two pages for the root to exercise paging
      if (parent === "ROOTFOLDER01" && !token) return json({ files: children.slice(0, 1), nextPageToken: "p2" });
      if (parent === "ROOTFOLDER01" && token) return json({ files: children.slice(1) });
      return json({ files: children });
    });
    return { fetchImpl, calls };
  }

  it("walks subfolders with paths, pages, resolves shortcuts and skips folder/unshared shortcuts", async () => {
    const { fetchImpl, calls } = driveFake(
      {
        ROOTFOLDER01: {
          name: "Crew Install References",
          children: [
            { id: "f1", name: "Coleman_R454B_Install_Quick_Reference.pdf", mimeType: "application/pdf", size: "345905", modifiedTime: "2026-10-29T05:31:39Z", webViewLink: "https://drive.google.com/file/d/f1/view" },
            { id: "SUB1", name: "Mitsubishi", mimeType: "application/vnd.google-apps.folder" },
            { id: "s1", name: "Bosch shortcut", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "t1", targetMimeType: "application/pdf" } },
            { id: "s2", name: "hidden", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "missing", targetMimeType: "application/pdf" } },
            { id: "s3", name: "folder shortcut", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "SUB1", targetMimeType: "application/vnd.google-apps.folder" } },
          ],
        },
        SUB1: {
          name: "Mitsubishi",
          children: [{ id: "f2", name: "MSZ-GL09NA install.pdf", mimeType: "application/pdf", webViewLink: "javascript:bad" }],
        },
      },
      { t1: { id: "t1", name: "Bosch Ultra HP install.pdf", mimeType: "application/pdf", webViewLink: "https://drive.google.com/file/d/t1/view" } },
    );

    const result = await listManualFolderTree(config, { fetchImpl, token: "tok" });
    expect(result.truncated).toBe(false);
    expect(result.foldersVisited).toBe(2);
    const byId = Object.fromEntries(result.files.map((f) => [f.driveFileId, f]));
    expect(Object.keys(byId).sort()).toEqual(["f1", "f2", "t1"]);
    expect(byId.f1).toMatchObject({ folderPath: "Crew Install References", sizeBytes: 345905, rootFolderId: "ROOTFOLDER01" });
    expect(byId.f2).toMatchObject({ folderPath: "Crew Install References / Mitsubishi", webViewLink: "", parentFolderId: "SUB1" });
    expect(byId.t1.name).toBe("Bosch Ultra HP install.pdf");
    // read-only: every call is a GET with a bearer token
    for (const [, init] of fetchImpl.mock.calls as unknown as Array<[string, RequestInit | undefined]>) {
      expect(init?.method ?? "GET").toBe("GET");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
    }
    expect(calls.some((c) => c.includes("pageToken=p2"))).toBe(true);
    expect(calls.every((c) => c.includes("supportsAllDrives=true"))).toBe(true);
  });

  it("fails clearly when a configured folder is not shared with the service account", async () => {
    const { fetchImpl } = driveFake({});
    await expect(listManualFolderTree(config, { fetchImpl, token: "tok" })).rejects.toThrow(/not shared/);
  });
});
