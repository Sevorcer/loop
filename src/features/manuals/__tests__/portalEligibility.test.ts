import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { listManualFolderTree } from "@/lib/manuals/driveClient";
import { DRIVE_ENV, readDriveSyncConfig } from "@/lib/manuals/driveConfig";

const FOLDER = "application/vnd.google-apps.folder";
const SHORTCUT = "application/vnd.google-apps.shortcut";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function driveFake(tree: Record<string, { name: string; children?: unknown[] }>, files: Record<string, unknown> = {}) {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    const id = decodeURIComponent(url.pathname.split("/files/")[1] ?? "");
    if (id) {
      if (tree[id]) return json({ id, name: tree[id].name, mimeType: FOLDER });
      if (files[id]) return json(files[id]);
      return json({}, 404);
    }
    const parent = (url.searchParams.get("q") ?? "").match(/'([^']+)' in parents/)?.[1] ?? "";
    return json({ files: tree[parent]?.children ?? [] });
  });
}

const pdf = (id: string, name: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  webViewLink: `https://drive.google.com/file/d/${id}/view`,
});

const baseConfig = {
  serviceAccountEmail: "loop@proj.iam.gserviceaccount.com",
  privateKey: "unused",
  folderIds: ["ROOTFOLDER01"],
};

describe("Customer manuals folder → portal eligibility", () => {
  const tree = {
    ROOTFOLDER01: {
      name: "Crew Install References",
      children: [
        pdf("internal1", "Field fixes.pdf"),
        { id: "CUSTOMER01", name: "Customer manuals", mimeType: FOLDER },
      ],
    },
    CUSTOMER01: {
      name: "Customer manuals",
      children: [
        pdf("cust1", "MSZ-GL09NA owner manual.pdf"),
        { id: "CUSTSUB001", name: "Bosch", mimeType: FOLDER },
        // a shortcut keeps the target's own sharing → never portal-eligible
        { id: "sc1", name: "shortcut", mimeType: SHORTCUT, shortcutDetails: { targetId: "elsewhere1", targetMimeType: "application/pdf" } },
        // a shortcut to an internal file stays internal
        { id: "sc2", name: "shortcut 2", mimeType: SHORTCUT, shortcutDetails: { targetId: "internal1", targetMimeType: "application/pdf" } },
      ],
    },
    CUSTSUB001: { name: "Bosch", children: [pdf("cust2", "Bosch IDS homeowner guide.pdf")] },
  };
  const files = { elsewhere1: pdf("elsewhere1", "Shared elsewhere.pdf"), internal1: pdf("internal1", "Field fixes.pdf") };

  it("marks only files directly inside the Customer manuals folder (and subfolders)", async () => {
    const result = await listManualFolderTree(
      { ...baseConfig, customerFolderId: "CUSTOMER01" },
      { fetchImpl: driveFake(tree, files), token: "tok" },
    );
    const byId = Object.fromEntries(result.files.map((f) => [f.driveFileId, f]));
    expect(byId.cust1.portalEligible).toBe(true);
    expect(byId.cust2.portalEligible).toBe(true);
    expect(byId.cust2.folderPath).toBe("Crew Install References / Customer manuals / Bosch");
    expect(byId.internal1.portalEligible).toBe(false);
    expect(byId.elsewhere1.portalEligible).toBe(false);
  });

  it("marks nothing when the Customer manuals folder is not configured", async () => {
    const result = await listManualFolderTree(
      { ...baseConfig, customerFolderId: null },
      { fetchImpl: driveFake(tree, files), token: "tok" },
    );
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.every((f) => f.portalEligible === false)).toBe(true);
  });

  it("walks a Customer manuals folder outside the manual roots as an extra root", async () => {
    const outside = {
      ROOTFOLDER01: { name: "Crew Install References", children: [pdf("internal1", "Field fixes.pdf")] },
      OUTSIDE001: { name: "Customer manuals", children: [pdf("cust9", "Homeowner guide.pdf")] },
    };
    const fetchImpl = driveFake(outside);
    const result = await listManualFolderTree({ ...baseConfig, customerFolderId: "OUTSIDE001" }, { fetchImpl, token: "tok" });
    const byId = Object.fromEntries(result.files.map((f) => [f.driveFileId, f]));
    expect(byId.cust9).toMatchObject({ portalEligible: true, rootFolderId: "OUTSIDE001", folderPath: "Customer manuals" });
    expect(byId.internal1.portalEligible).toBe(false);
    for (const [, init] of fetchImpl.mock.calls as unknown as Array<[string, RequestInit | undefined]>) {
      expect(init?.method ?? "GET").toBe("GET");
    }
  });

  it("does not walk the Customer manuals folder twice when it is inside a root", async () => {
    const fetchImpl = driveFake(tree, files);
    const result = await listManualFolderTree({ ...baseConfig, customerFolderId: "CUSTOMER01" }, { fetchImpl, token: "tok" });
    expect(result.foldersVisited).toBe(3);
  });
});

describe("GOOGLE_DRIVE_CUSTOMER_MANUALS_FOLDER_ID", () => {
  const env = {
    [DRIVE_ENV.email]: "loop@proj.iam.gserviceaccount.com",
    [DRIVE_ENV.privateKey]: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
    [DRIVE_ENV.folderIds]: "19MTHJGb6LlMgqluLHqOKD_mHFQ-vxj3R",
  };

  it("is optional: Drive stays connected without it and nothing is portal-visible", () => {
    const { config, status } = readDriveSyncConfig(env);
    expect(status.configured).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.customerFolderConfigured).toBe(false);
    expect(config?.customerFolderId).toBeNull();
  });

  it("accepts a bare id or a pasted folder URL", () => {
    const a = readDriveSyncConfig({ ...env, [DRIVE_ENV.customerFolderId]: "1AbCdEfGhIjKlMnOp" });
    expect(a.config?.customerFolderId).toBe("1AbCdEfGhIjKlMnOp");
    expect(a.status.customerFolderConfigured).toBe(true);
    const b = readDriveSyncConfig({
      ...env,
      [DRIVE_ENV.customerFolderId]: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing",
    });
    expect(b.config?.customerFolderId).toBe("1AbCdEfGhIjKlMnOp");
  });

  it("still reports 'not connected yet' when the required vars are missing", () => {
    const { config, status } = readDriveSyncConfig({ [DRIVE_ENV.customerFolderId]: "1AbCdEfGhIjKlMnOp" });
    expect(config).toBeNull();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual([DRIVE_ENV.email, DRIVE_ENV.privateKey, DRIVE_ENV.folderIds]);
    expect(status.customerFolderConfigured).toBe(true);
  });
});
