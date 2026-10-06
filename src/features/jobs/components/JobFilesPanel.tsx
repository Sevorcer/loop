"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";

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
  uploaderRole: string | null;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const filesToUpload = Array.from(fileList);

    // Client-side validation — mirrors server checks for fast, actionable feedback.
    // Validate all files up front so the user knows about problems before any upload starts.
    for (const file of filesToUpload) {
      const validationError = validateJobFile({
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (validationError) {
        setError(`${file.name}: ${validationError}`);
        return;
      }
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const headers = new Headers();
      if (process.env.NODE_ENV !== "production" && role) {
        headers.set("x-loop-role", role);
      }

      let uploadedCount = 0;
      const errors: string[] = [];

      // Upload each file individually so one failure doesn't block the rest.
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.set("file", file);

        try {
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
          uploadedCount++;
        } catch (fileError) {
          errors.push(
            `${file.name}: ${fileError instanceof Error ? fileError.message : "Upload failed."}`,
          );
        }
      }

      await loadFiles();

      if (errors.length > 0) {
        setError(
          uploadedCount > 0
            ? `${uploadedCount} of ${filesToUpload.length} files uploaded. Failed: ${errors.join("; ")}`
            : `Upload failed: ${errors.join("; ")}`,
        );
      } else {
        setSuccess(
          filesToUpload.length === 1
            ? "File uploaded successfully."
            : `${uploadedCount} files uploaded successfully.`,
        );
      }
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
      // Use programmatic anchor click to avoid popup blocker
      const a = document.createElement("a"); a.href = result.url; a.download = result.fileName;  a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
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

        {/* Upload controls — two affordances for mobile (camera vs file picker).
            `multiple` lets the OS picker select several files at once (and on Android
            surfaces the gallery grid instead of just camera/files). */}
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
                void handleUpload(input.files).finally(() => {
                  // Clear so the same files can be selected again
                  input.value = "";
                });
              }}
              disabled={uploading}
            />
          </label>

          {/* Camera shortcut — on mobile, accept="image/*" automatically prompts camera */}
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
                void handleUpload(input.files).finally(() => {
                  // Clear so the same files can be selected again
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
                  // F14: glove-sized file action target.
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
