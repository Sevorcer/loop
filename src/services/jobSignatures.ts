import "server-only";

import { randomUUID } from "crypto";

import type { JobSignature } from "@/features/jobs/types/jobSignature";
import { signatureCaptureError } from "@/features/jobs/utils/jobSignature";
import { createJobActivity, getJobById } from "@/repositories/jobs";
import {
  insertJobSignature,
  listJobSignatures,
  toJobSignature,
} from "@/repositories/jobSignatures";
import { getCurrentOperator } from "@/services/currentOperator";
import { getDownloadUrl, uploadStorageFile } from "@/services/storage";
import type { AppRole } from "@/services/authorization";

const SIGNATURE_BUCKET = "job-signatures";
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

export interface SignatureCaptureContext {
  actorId?: string;
  role: AppRole;
}

function isMissingSignatureStore(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /job_signatures|job-signatures/i.test(message) && /does not exist|schema cache|could not find|bucket not found/i.test(message);
}

function permissionError(error: unknown): Error | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/row-level security|42501/i.test(message)) {
    const wrapped = new Error("You don't have permission to save a signature on this job.");
    (wrapped as { status?: number }).status = 403;
    return wrapped;
  }
  return null;
}

async function capturerName(context: SignatureCaptureContext): Promise<string> {
  try {
    const operator = await getCurrentOperator();
    if (operator.name.trim()) return operator.name.trim();
  } catch {
    // The signature still records the role when the profile lookup fails.
  }
  return "Team";
}

export async function listJobSignaturesForJob(
  jobId: string,
  role: AppRole,
): Promise<JobSignature[]> {
  try {
    const rows = await listJobSignatures(jobId);
    const signatures: JobSignature[] = [];
    for (const row of rows) {
      let previewUrl: string | null = null;
      try {
        previewUrl = await getDownloadUrl(role, row.storage_object_id, 600);
      } catch {
        previewUrl = null;
      }
      signatures.push(toJobSignature(row, previewUrl));
    }
    return signatures;
  } catch (error) {
    if (isMissingSignatureStore(error)) return [];
    throw error;
  }
}

export async function captureJobSignature(
  jobId: string,
  input: { signerName: string; file: Uint8Array; mimeType: string; sizeBytes: number },
  context: SignatureCaptureContext,
): Promise<JobSignature> {
  const validationError = signatureCaptureError({
    signerName: input.signerName,
    hasInk: input.sizeBytes > 0,
  });
  if (validationError) throw new Error(validationError);
  if (input.mimeType !== "image/png") {
    throw new Error("Signature image must be a PNG.");
  }
  if (input.sizeBytes > MAX_SIGNATURE_BYTES) {
    throw new Error("Signature image must be 2 MB or smaller.");
  }

  const job = await getJobById(jobId);
  if (!job) {
    const missing = new Error("Job not found.");
    (missing as { status?: number }).status = 404;
    throw missing;
  }

  const signerName = input.signerName.trim();
  const capturedByName = await capturerName(context);
  const storagePath = `jobs/${jobId}/${randomUUID()}.png`;

  try {
    const uploaded = await uploadStorageFile(context.role, {
      bucket: SIGNATURE_BUCKET,
      storagePath,
      fileName: "customer-signature.png",
      mimeType: "image/png",
      sizeBytes: input.sizeBytes,
      file: input.file,
      jobId,
      visibility: "internal",
      uploadedBy: context.actorId || null,
    });

    const row = await insertJobSignature({
      jobId,
      storageObjectId: uploaded.id,
      signerName,
      capturedBy: context.actorId || null,
      capturedByName,
      capturedByRole: context.role,
    });

    await createJobActivity({
      jobId,
      actorId: context.actorId,
      type: "signature",
      title: "Customer signature captured",
      description: `${signerName} signed. Captured by ${capturedByName}.`,
    });

    let previewUrl: string | null = null;
    try {
      previewUrl = await getDownloadUrl(context.role, uploaded.id, 600);
    } catch {
      previewUrl = null;
    }
    return toJobSignature(row, previewUrl);
  } catch (error) {
    if (isMissingSignatureStore(error)) {
      throw new Error("Signature capture is not available until the latest database update is applied.");
    }
    const denied = permissionError(error);
    if (denied) throw denied;
    throw error;
  }
}
