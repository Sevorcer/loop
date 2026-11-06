import "server-only";

import {
  MAX_NAMEPLATE_READ_BYTES,
  NAMEPLATE_UNCONFIGURED_MESSAGE,
  NAMEPLATE_UNREADABLE_MESSAGE,
  NAMEPLATE_VISION_MIME_TYPES,
  normalizeNameplateMime,
  parseNameplateModelContent,
  unreadableExtraction,
  type NameplateExtraction,
} from "@/features/installed-systems/utils/nameplateRead";

const DEFAULT_MODEL = "gpt-4o-mini";

const PROMPT = [
  "You read HVAC equipment nameplates.",
  "Extract only the model number and the serial number that are clearly printed on the nameplate.",
  "Return JSON with keys readable (boolean), modelNumber (string or null), and serialNumber (string or null).",
  "If a value is blurry, cropped, guessed, or not actually a model or serial, set readable to false and both values to null.",
  "Do not explain and do not include any other equipment data.",
].join(" ");

export function isNameplateVisionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Read a nameplate image. When OPENAI_API_KEY is unset this returns
 * unreadable and does not call a vendor. It never writes model or serial.
 */
export async function extractNameplateFromImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<NameplateExtraction> {
  const mime = normalizeNameplateMime(mimeType);
  if (mime === "image/heic" || mime === "image/heif") {
    return unreadableExtraction(
      "This photo format cannot be read. Upload a JPEG, PNG, or WebP of the nameplate. Model and serial were left unchanged.",
    );
  }
  if (!NAMEPLATE_VISION_MIME_TYPES.has(mime)) {
    return unreadableExtraction(
      "This file is not a photo Loop can read. Upload a JPEG, PNG, or WebP nameplate. Model and serial were left unchanged.",
    );
  }
  if (bytes.byteLength > MAX_NAMEPLATE_READ_BYTES) {
    return unreadableExtraction(
      "This photo is too large to read. Upload one under 8 MB. Model and serial were left unchanged.",
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return unreadableExtraction(NAMEPLATE_UNCONFIGURED_MESSAGE);
  }

  const model = process.env.OPENAI_NAMEPLATE_MODEL?.trim() || DEFAULT_MODEL;
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }

  if (!response.ok) {
    return unreadableExtraction(
      response.status === 401
        ? "This photo could not be read. The nameplate reading key was rejected. Model and serial were left unchanged."
        : NAMEPLATE_UNREADABLE_MESSAGE,
    );
  }

  let content = "";
  try {
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = payload.choices?.[0]?.message?.content ?? "";
  } catch {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }

  const extraction = parseNameplateModelContent(content);
  if (extraction.status === "unreadable" && !extraction.message) {
    return unreadableExtraction(NAMEPLATE_UNREADABLE_MESSAGE);
  }
  return extraction.status === "read"
    ? { ...extraction, message: extraction.message || "Read from the nameplate photo." }
    : extraction;
}
