import { describe, expect, it } from "vitest";

import { normalizePrivateKey, parseFolderIds, readDriveSyncConfig } from "@/lib/manuals/driveConfig";

const KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";

describe("readDriveSyncConfig", () => {
  it("is not configured and lists missing var NAMES when env is empty", () => {
    const { config, status } = readDriveSyncConfig({});
    expect(config).toBeNull();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual([
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_DRIVE_MANUAL_FOLDER_IDS",
    ]);
  });

  it("is configured when all three are set, without echoing the key", () => {
    const { config, status } = readDriveSyncConfig({
      GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "loop@proj.iam.gserviceaccount.com",
      GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: KEY,
      GOOGLE_DRIVE_MANUAL_FOLDER_IDS: "19MTHJGb6LlMgqluLHqOKD_mHFQ-vxj3R",
    });
    expect(status).toEqual({
      configured: true,
      missing: [],
      folderCount: 1,
      serviceAccountEmail: "loop@proj.iam.gserviceaccount.com",
    });
    expect(JSON.stringify(status)).not.toContain("PRIVATE KEY");
    expect(config?.privateKey).toContain("\n");
  });

  it("accepts pasted folder URLs and dedupes", () => {
    expect(
      parseFolderIds(
        "https://drive.google.com/drive/folders/19MTHJGb6LlMgqluLHqOKD_mHFQ-vxj3R, 19MTHJGb6LlMgqluLHqOKD_mHFQ-vxj3R  bad'id",
      ),
    ).toEqual(["19MTHJGb6LlMgqluLHqOKD_mHFQ-vxj3R"]);
  });

  it("turns literal \\n escapes into newlines", () => {
    expect(normalizePrivateKey(KEY).split("\n")).toHaveLength(3);
  });
});
