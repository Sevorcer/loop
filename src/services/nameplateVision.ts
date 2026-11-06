import "server-only";

import os from "os";

import {
  MAX_NAMEPLATE_READ_BYTES,
  NAMEPLATE_READER_FAILED_MESSAGE,
  NAMEPLATE_UNREADABLE_MESSAGE,
  NAMEPLATE_VISION_MIME_TYPES,
  normalizeNameplateMime,
  parseNameplateOcrText,
  unreadableExtraction,
  type NameplateExtraction,
} from "@/features/installed-systems/utils/nameplateRead";

async function convertHeicToJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const convert = (await import("heic-convert")).default;
  const output = await convert({
    buffer: bytes,
    format: "JPEG",
    quality: 0.85,
  });
  return new Uint8Array(output);
}

/**
 * JPEG, PNG, and WebP pass through. HEIC and HEIF (typical iPhone photos)
 * are converted to JPEG before local OCR.
 */
export async function prepareNameplateImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | { unreadable: string }> {
  const mime = normalizeNameplateMime(mimeType);
  if (mime === "image/heic" || mime === "image/heif") {
    try {
      const jpeg = await convertHeicToJpeg(bytes);
      if (jpeg.byteLength === 0) {
        return { unreadable: "This phone photo could not be converted. Model and serial were left unchanged." };
      }
      return { bytes: jpeg, mimeType: "image/jpeg" };
    } catch {
      return { unreadable: "This phone photo could not be converted. Model and serial were left unchanged." };
    }
  }
  if (!NAMEPLATE_VISION_MIME_TYPES.has(mime)) {
    return { unreadable: NAMEPLATE_UNREADABLE_MESSAGE };
  }
  if (bytes.byteLength > MAX_NAMEPLATE_READ_BYTES) {
    return { unreadable: "This photo is too large to read. Model and serial were left unchanged." };
  }
  return { bytes, mimeType: mime };
}

type OcrWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text?: string | null } }>;
  terminate: () => Promise<unknown>;
};

/**
 * Tesseract.js runs in this process. English traineddata is read from the
 * installed package, not downloaded per photo, and the image is not sent
 * to a third-party API.
 */
async function createLocalOcrWorker(): Promise<OcrWorker> {
  const { createWorker } = await import("tesseract.js");
  const eng = (await import("@tesseract.js-data/eng")).default;
  return createWorker("eng", 1, {
    langPath: eng.langPath,
    gzip: eng.gzip,
    cachePath: os.tmpdir(),
    // A bad image rejects the recognize promise and, without this, also
    // throws on the worker message handler and can take down the request.
    errorHandler: () => {},
  });
}

/**
 * Open one local OCR worker, let the caller read several photos, then close it.
 * A photo that cannot be read returns an unreadable result and does not invent values.
 */
export async function withNameplateOcr<T>(
  run: (read: (bytes: Uint8Array, mimeType: string) => Promise<NameplateExtraction>) => Promise<T>,
): Promise<T> {
  const session: { worker: OcrWorker | null } = { worker: null };
  let failed = false;

  const read = async (bytes: Uint8Array, mimeType: string): Promise<NameplateExtraction> => {
    if (failed) return unreadableExtraction(NAMEPLATE_READER_FAILED_MESSAGE);
    const prepared = await prepareNameplateImage(bytes, mimeType);
    if ("unreadable" in prepared) return unreadableExtraction(prepared.unreadable);
    if (!session.worker) {
      try {
        session.worker = await createLocalOcrWorker();
      } catch {
        failed = true;
        return unreadableExtraction(NAMEPLATE_READER_FAILED_MESSAGE);
      }
    }
    try {
      const result = await session.worker.recognize(Buffer.from(prepared.bytes));
      return parseNameplateOcrText(result.data.text ?? "");
    } catch {
      return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
    }
  };

  try {
    return await run(read);
  } finally {
    await session.worker?.terminate();
  }
}

/** Read one image with the local OCR worker. */
export async function extractNameplateFromImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<NameplateExtraction> {
  return withNameplateOcr((read) => read(bytes, mimeType));
}
