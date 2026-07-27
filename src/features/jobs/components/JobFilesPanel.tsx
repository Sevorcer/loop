"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Paperclip, Upload } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

interface JobFileMeta {
  id: string;
  fileName: string;
  mimeType: string;
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

      setSuccess("File uploaded.");
      await loadFiles();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
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

        <div className="mt-4">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload photo or file"}
            <input
              type="file"
              className="hidden"
              onChange={(event) => void handleUpload(event.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

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
              Loading files...
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
                  <Camera className="h-4 w-4 text-blue-300" />
                ) : (
                  <Paperclip className="h-4 w-4 text-slate-300" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-200">{file.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(file.createdAt).toLocaleString()}
                  </p>
                </div>
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
