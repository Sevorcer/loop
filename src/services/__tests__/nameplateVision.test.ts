import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NAMEPLATE_UNCONFIGURED_MESSAGE, NAMEPLATE_UNREADABLE_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";
import { extractNameplateFromImage } from "@/services/nameplateVision";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("extractNameplateFromImage", () => {
  it("does not call a vendor or invent a reading when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("unreadable");
    expect(result.modelNumber).toBeNull();
    expect(result.serialNumber).toBeNull();
    expect(result.message).toBe(NAMEPLATE_UNCONFIGURED_MESSAGE);
  });

  it("proposes model and serial from a successful vision response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            readable: true,
            modelNumber: "MXZ-3C24NAHZ2",
            serialNumber: "SN1234567",
          }),
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "read",
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    });
  });

  it("reports a photo that cannot be read and does not return numbers", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ readable: false, modelNumber: null, serialNumber: null }) } }],
    }), { status: 200 })));

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(result.status).toBe("unreadable");
    expect(result.modelNumber).toBeNull();
    expect(result.serialNumber).toBeNull();
    expect(result.message).toBe(NAMEPLATE_UNREADABLE_MESSAGE);
  });

  it("does not send HEIC to the reader", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(jpeg, "image/heic");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("unreadable");
    expect(result.message).toMatch(/left unchanged/i);
  });
});
