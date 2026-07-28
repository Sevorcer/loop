"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Download, FileText, Loader2, Paperclip, Upload } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { ALLOWED_FILE_ACCEPT, MAX_JOB_FILE_SIZE_BYTES, validateJobFile, formatFileSize } from "@/lib/fileValidation";

interface JobFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export function JobFilesPanel({
  jobId,
  onFilesChanged,
}: {
  jobId: string;
  onFilesChanged?: (files: JobFileMeta[]) => void;
}) {
  const { role } = useCurrentRole();
  const [files, setFiles] = useState<JobFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const imageCount = useMemo(
    () => files.filter((file) => file.mimeType.toLowerCase().startsWith("image/")).length,
    [files],
  );

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }, [jobId, onFilesChanged, role]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadFiles();
    });
  }, [loadFiles]);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !role) {
      return;
    }

    const uploadFile = fileList[0];

    // Client-side validation — mirrors server checks for fast, actionable feedback
    const validationError = validateJobFile({
      mimeType: uploadFile.type || "application/octet-stream",
      sizeBytes: uploadFile.size,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.set("file", uploadFile);

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const headers = new Headers();
      if (process.env.NODE_ENV !== "production" && role) {
        headers.set("x-loop-role", role);
      }

      const response = await fetch(`/api/jobs/${jobId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
        headers,
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? payload?.error ?? "Upload failed.");
      }

      setSuccess("File uploaded successfully.");
      await loadFiles();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
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
      // Open in a new tab; browser handles download for non-previewable types
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not generate download link. Please try again.");
    } finally {
      setDownloadingId(null);
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

        {/* Upload controls — two affordances for mobile (camera vs file picker) */}
        <div className="mt-4 flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload file"}
            <input
              type="file"
              className="hidden"
              accept={ALLOWED_FILE_ACCEPT}
              onChange={(event) => void handleUpload(event.target.files)}
              disabled={uploading}
            />
          </label>

          {/* Camera shortcut — captures directly on mobile devices */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
            <Camera className="h-4 w-4" />
            <span className="sr-only">Take photo</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              // eslint-disable-next-line react/no-unknown-property
              capture="environment"
              onChange={(event) => void handleUpload(event.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          JPEG, PNG, WebP, HEIC, PDF · max {formatFileSize(MAX_JOB_FILE_SIZE_BYTES)}
        </p>

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
                  className="h-7 w-7 shrink-0 p-0 text-slate-400 hover:text-white"
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

