import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const convertHeic = vi.hoisted(() => vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer));
const recognize = vi.hoisted(() => vi.fn());
const terminate = vi.hoisted(() => vi.fn(async () => undefined));
const createWorker = vi.hoisted(() => vi.fn(async () => ({ recognize, terminate })));

vi.mock("heic-convert", () => ({
  default: convertHeic,
}));

vi.mock("tesseract.js", () => ({
  createWorker,
}));

vi.mock("@tesseract.js-data/eng", () => ({
  default: { code: "eng", gzip: true, langPath: "/tmp/eng" },
}));

import { NAMEPLATE_READER_FAILED_MESSAGE, NAMEPLATE_UNREADABLE_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";
import { extractNameplateFromImage } from "@/services/nameplateVision";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const heic = new Uint8Array([0, 1, 2, 3, 4]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  convertHeic.mockClear();
  recognize.mockReset();
  terminate.mockClear();
  createWorker.mockClear();
});

describe("extractNameplateFromImage", () => {
  it("reads model and serial with local OCR and does not call a paid API", async () => {
    vi.stubEnv("OPENAI_API_KEY", "should-not-be-used");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    recognize.mockResolvedValue({
      data: { text: "MODEL NO. MXZ-3C24NAHZ2\nSERIAL NO. SN1234567\n" },
    });

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createWorker).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "read",
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    });
    expect(terminate).toHaveBeenCalledOnce();
  });

  it("still reads when no API key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    recognize.mockResolvedValue({
      data: { text: "MODEL MXZ-3C24NAHZ2\nS/N SN1234567" },
    });

    const result = await extractNameplateFromImage(jpeg, "image/png");

    expect(result.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(result.serialNumber).toBe("SN1234567");
  });

  it("converts an iPhone HEIC photo to JPEG before OCR", async () => {
    recognize.mockResolvedValue({
      data: { text: "MODEL NO. MXZ-3C24NAHZ2\nSERIAL NO. SN1234567" },
    });

    const result = await extractNameplateFromImage(heic, "image/heic");

    expect(convertHeic).toHaveBeenCalledOnce();
    expect(recognize).toHaveBeenCalledOnce();
    const passed = recognize.mock.calls[0][0] as Buffer;
    expect(Buffer.from(passed).equals(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(true);
    expect(result.modelNumber).toBe("MXZ-3C24NAHZ2");
  });

  it("reports a photo that cannot be read and does not invent numbers", async () => {
    recognize.mockResolvedValue({ data: { text: "blue sky and a fence" } });

    const result = await extractNameplateFromImage(jpeg, "image/jpeg");

    expect(result.status).toBe("unreadable");
    expect(result.modelNumber).toBeNull();
    expect(result.serialNumber).toBeNull();
    expect(result.message).toBe(NAMEPLATE_UNREADABLE_MESSAGE);
  });

  it("says reading could not start when the local reader fails", async () => {
    createWorker.mockRejectedValueOnce(new Error("worker failed"));

    const result = await extractNameplateFromImage(jpeg, "image/webp");

    expect(result.status).toBe("unreadable");
    expect(result.modelNumber).toBeNull();
    expect(result.message).toBe(NAMEPLATE_READER_FAILED_MESSAGE);
  });

  it("does not run OCR when a HEIC photo cannot be converted", async () => {
    convertHeic.mockRejectedValueOnce(new Error("not a heic"));

    const result = await extractNameplateFromImage(heic, "image/heif");

    expect(createWorker).not.toHaveBeenCalled();
    expect(result.status).toBe("unreadable");
    expect(result.message).toMatch(/left unchanged/i);
  });
});
