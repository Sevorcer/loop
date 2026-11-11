"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, FileText, Loader2, Paperclip, Trash2, Upload, RotateCcw, X } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { ALLOWED_FILE_ACCEPT, MAX_JOB_FILE_SIZE_BYTES, validateJobFile, formatFileSize } from "@/lib/fileValidation";
import { isNameplateCandidate } from "@/features/installed-systems/utils/nameplateRead";
import { applyFileDownload } from "@/features/jobs/utils/fileDownload";
import {
  createPendingUpload,
  formatPendingUploadError,
  revokePendingPreview,
  type PendingJobUpload,
} from "@/features/jobs/utils/jobFileUploadQueue";

import { JobNameplateRead } from "./JobNameplateRead";
import { JobPhotoGrid } from "./JobPhotoGrid";

interface JobFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploaderRole: string | null;
  createdAt: string;
  previewUrl?: string | null;
}

let pendingIdCounter = 0;
function nextPendingId(): string {
  pendingIdCounter += 1;
  return `pending-${Date.now()}-${pendingIdCounter}`;
}

/** Abort signal that fires after `ms` — an upload step must never hang silently. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function JobFilesPanel({
  jobId,
  onFilesChanged,
  onCountChange,
}: {
  jobId: string;
  onFilesChanged?: (files: JobFileMeta[]) => void;
  /** Optional: reports the current file count whenever the list changes (e.g. for a tab badge). */
  onCountChange?: (count: number) => void;
}) {
  const { role } = useCurrentRole();
  const [files, setFiles] = useState<JobFileMeta[]>([]);
  const [pending, setPending] = useState<PendingJobUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const imageCount = useMemo(
    () => files.filter((file) => file.mimeType.toLowerCase().startsWith("image/")).length,
    [files],
  );
  const canSearchNameplate = useMemo(() => files.some((file) => isNameplateCandidate(file)), [files]);

  const uploading = pending.some((item) => item.status === "uploading");

  const loadFiles = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    try {
      setError(null);
      const response = await requestJson<{ files: JobFileMeta[] }>(`/api/jobs/${jobId}/files`, {
        role,
        cache: "no-store",
      });
      const nextFiles = response.files ?? [];
      setFiles(nextFiles);
      onFilesChanged?.(nextFiles);
      onCountChange?.(nextFiles.length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }, [jobId, onCountChange, onFilesChanged, role]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadFiles();
    });
  }, [loadFiles]);

  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) {
        revokePendingPreview(item);
      }
    };
  }, []);

  function patchPending(clientId: string, patch: Partial<PendingJobUpload>) {
    setPending((current) =>
      current.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)),
    );
  }

  function discardPending(clientId: string) {
    setPending((current) => {
      const target = current.find((item) => item.clientId === clientId);
      if (target) revokePendingPreview(target);
      return current.filter((item) => item.clientId !== clientId);
    });
  }

  async function uploadOne(item: PendingJobUpload): Promise<boolean> {
    if (!role) return false;

    patchPending(item.clientId, { status: "uploading", error: null });

    const file = item.file;
    const mimeType = file.type || "application/octet-stream";

    try {
      // Files go straight to Storage through a signed URL (sign → PUT →
      // complete): proxying the bytes through the app server silently
      // killed any photo over the platform's ~4.5 MB request limit. Every
      // step is time-boxed so a stalled request lands in the retry queue
      // instead of spinning on "Uploading…" forever.
      const signed = await requestJson<{ signedUrl: string; storagePath: string }>(
        `/api/jobs/${jobId}/files/sign`,
        {
          method: "POST",
          role,
          body: { fileName: file.name, mimeType, sizeBytes: file.size },
          signal: timeoutSignal(30_000),
        },
      );

      const putResponse = await fetch(signed.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": mimeType, "x-upsert": "false" },
        // ~2 minutes plus ~15s per MB — generous for field connections.
        signal: timeoutSignal(120_000 + Math.ceil(file.size / (1024 * 1024)) * 15_000),
      });
      if (!putResponse.ok) {
        throw new Error(`Storage rejected the upload (${putResponse.status}).`);
      }

      await requestJson(`/api/jobs/${jobId}/files/complete`, {
        method: "POST",
        role,
        body: {
          storagePath: signed.storagePath,
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
        },
        signal: timeoutSignal(45_000),
      });

      revokePendingPreview(item);
      setPending((current) => current.filter((row) => row.clientId !== item.clientId));
      return true;
    } catch (fileError) {
      const reason =
        fileError instanceof Error && fileError.name === "AbortError"
          ? "Upload timed out — check your connection and retry."
          : fileError instanceof Error && fileError.message.trim()
            ? fileError.message
            : "Network error — check your connection and retry.";
      patchPending(item.clientId, {
        status: "failed",
        error: formatPendingUploadError(item.file.name, reason),
      });
      return false;
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !role) {
      return;
    }

    const filesToUpload = Array.from(fileList);
    const accepted: PendingJobUpload[] = [];

    for (const file of filesToUpload) {
      const validationError = validateJobFile({
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (validationError) {
        // Keep invalid files visible too so the tech can see why and discard.
        accepted.push({
          ...createPendingUpload(file, nextPendingId()),
          status: "failed",
          error: formatPendingUploadError(file.name, validationError),
        });
        continue;
      }
      accepted.push(createPendingUpload(file, nextPendingId()));
    }

    if (accepted.length === 0) return;

    setSuccess(null);
    setError(null);
    setPending((current) => [...current, ...accepted]);

    let uploadedCount = 0;
    for (const item of accepted) {
      if (item.status === "failed") continue;
      const ok = await uploadOne(item);
      if (ok) uploadedCount += 1;
    }

    await loadFiles();

    if (uploadedCount > 0) {
      setSuccess(
        uploadedCount === 1
          ? "File uploaded successfully."
          : `${uploadedCount} files uploaded successfully.`,
      );
    }
  }

  async function handleRetry(clientId: string) {
    const item = pendingRef.current.find((row) => row.clientId === clientId);
    if (!item || item.status === "uploading") return;
    setError(null);
    setSuccess(null);
    const ok = await uploadOne({ ...item, status: "queued", error: null });
    await loadFiles();
    if (ok) {
      setSuccess("File uploaded successfully.");
    }
  }

  async function handleDownload(file: JobFileMeta) {
    if (!role) return;
    setDownloadingId(file.id);
    try {
      const result = await requestJson<{ url: string; fileName: string }>(
        `/api/jobs/${jobId}/files/${file.id}`,
        { role, cache: "no-store" },
      );
      const a = document.createElement("a");
      applyFileDownload(a, result.url, result.fileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Could not generate download link. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(file: JobFileMeta) {
    if (!role) return;
    if (!window.confirm(`Delete "${file.fileName}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(file.id);
    try {
      setError(null);
      await requestJson(`/api/jobs/${jobId}/files/${file.id}`, {
        method: "DELETE",
        role,
      });
      setSuccess("File deleted.");
      await loadFiles();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete file.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Photos & Files</h2>
            <p className="mt-1 text-sm text-slate-400">
              Upload field photos and supporting files tied to this job.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
            {imageCount} photo{imageCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload files"}
            <input
              type="file"
              className="sr-only"
              accept={ALLOWED_FILE_ACCEPT}
              multiple
              onChange={(event) => {
                const input = event.target;
                const list = input.files;
                // Clear the input so the same files can be picked again later,
                // but the File objects live on in `pending` until success/discard.
                void handleUpload(list).finally(() => {
                  input.value = "";
                });
              }}
              disabled={uploading}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
            <Camera className="h-4 w-4" />
            <span className="sr-only">Take photo</span>
            <input
              type="file"
              className="sr-only"
              accept="image/*"
              multiple
              onChange={(event) => {
                const input = event.target;
                const list = input.files;
                void handleUpload(list).finally(() => {
                  input.value = "";
                });
              }}
              disabled={uploading}
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          JPEG, PNG, WebP, HEIC, PDF · max {formatFileSize(MAX_JOB_FILE_SIZE_BYTES)} per file ·
          select multiple files at once
        </p>

        {pending.length > 0 ? (
          <div className="mt-4 space-y-2" data-testid="pending-uploads">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending uploads
            </p>
            {pending.map((item) => (
              <div
                key={item.clientId}
                data-pending-status={item.status}
                className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : item.file.type.toLowerCase().startsWith("image/") ? (
                  <Camera className="h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0 text-amber-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">{item.file.name}</p>
                  <p className="text-xs text-amber-200/90">
                    {item.status === "uploading"
                      ? "Uploading…"
                      : item.status === "queued"
                        ? "Waiting…"
                        : item.error ?? "Upload failed."}
                  </p>
                </div>
                {item.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-300" />
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] shrink-0 p-0 text-amber-200 hover:text-white"
                      onClick={() => void handleRetry(item.clientId)}
                      aria-label={`Retry ${item.file.name}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] shrink-0 p-0 text-slate-400 hover:text-red-300"
                      onClick={() => discardPending(item.clientId)}
                      aria-label={`Discard ${item.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <JobPhotoGrid photos={files} />

        {canSearchNameplate ? <JobNameplateRead jobId={jobId} /> : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {success}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-slate-500">No uploads yet.</p>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                {file.mimeType.toLowerCase().startsWith("image/") ? (
                  <Camera className="h-4 w-4 shrink-0 text-blue-300" />
                ) : file.mimeType === "application/pdf" ? (
                  <FileText className="h-4 w-4 shrink-0 text-red-300" />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">{file.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] shrink-0 p-0 text-slate-400 hover:text-white"
                  onClick={() => void handleDownload(file)}
                  disabled={downloadingId === file.id}
                  aria-label={`Download ${file.fileName}`}
                >
                  {downloadingId === file.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] shrink-0 p-0 text-slate-400 hover:text-red-300"
                  onClick={() => void handleDelete(file)}
                  disabled={deletingId === file.id}
                  aria-label={`Delete ${file.fileName}`}
                >
                  {deletingId === file.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => void loadFiles()} disabled={loading || uploading}>
            Refresh
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}
