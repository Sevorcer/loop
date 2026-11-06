import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const convertHeic = vi.hoisted(() => vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer));

vi.mock("heic-convert", () => ({
  default: convertHeic,
}));

import { NAMEPLATE_UNCONFIGURED_MESSAGE, NAMEPLATE_UNREADABLE_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";
import { extractNameplateFromImage } from "@/services/nameplateVision";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const heic = new Uint8Array([0, 1, 2, 3, 4]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  convertHeic.mockClear();
});

describe("extractNameplateFromImage", () => {
  it("does not call a vendor or invent a reading when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(convertHeic).not.toHaveBeenCalled();
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

  it("converts an iPhone HEIC photo to JPEG before reading it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      expect(body).toContain("data:image/jpeg;base64,");
      expect(body).not.toContain("image/heic");
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              readable: true,
              modelNumber: "MXZ-3C24NAHZ2",
              serialNumber: "SN1234567",
            }),
          },
        }],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(heic, "image/heic");

    expect(convertHeic).toHaveBeenCalledOnce();
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

  it("does not call the vendor when a HEIC photo cannot be converted", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    convertHeic.mockRejectedValueOnce(new Error("not a heic"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNameplateFromImage(heic, "image/heif");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("unreadable");
    expect(result.message).toMatch(/left unchanged/i);
  });
});
