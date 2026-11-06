"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Loader2, ScanLine, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { PermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { formatFileSize, MAX_JOB_FILE_SIZE_BYTES } from "@/lib/fileValidation";

import {
  NAMEPLATE_PHOTO_ACCEPT,
  type NameplateReview,
} from "../utils/nameplateRead";

interface NameplatePhoto {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  previewUrl: string | null;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export function InstalledSystemNameplateCard({
  systemId,
  modelNumber,
  serialNumber,
}: {
  systemId: string;
  modelNumber: string;
  serialNumber: string;
}) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [photos, setPhotos] = useState<NameplatePhoto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<NameplateReview | null>(null);
  const [draftModel, setDraftModel] = useState("");
  const [draftSerial, setDraftSerial] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const response = await requestJson<{ photos: NameplatePhoto[] }>(
        `/api/installed-systems/${systemId}/photos`,
        { role, cache: "no-store" },
      );
      const next = response.photos ?? [];
      setPhotos(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load photos.");
    } finally {
      setLoading(false);
    }
  }, [role, systemId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadPhotos();
    });
  }, [loadPhotos]);

  async function uploadOne(file: File) {
    if (!role) return;
    setUploading(true);
    setError(null);
    setSavedNote(null);
    try {
      const mimeType = file.type || "application/octet-stream";
      const signed = await requestJson<{ signedUrl: string; storagePath: string; fileName: string }>(
        `/api/installed-systems/${systemId}/photos/sign`,
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
        signal: timeoutSignal(120_000),
      });
      if (!putResponse.ok) {
        throw new Error("The photo did not upload. Try again.");
      }
      const completed = await requestJson<{ photo: NameplatePhoto }>(
        `/api/installed-systems/${systemId}/photos/complete`,
        {
          method: "POST",
          role,
          body: {
            storagePath: signed.storagePath,
            fileName: signed.fileName,
            mimeType,
            sizeBytes: file.size,
          },
        },
      );
      setSelectedId(completed.photo.id);
      setReview(null);
      await loadPhotos();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The photo did not upload.");
    } finally {
      setUploading(false);
    }
  }

  function onPick(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    void uploadOne(file);
  }

  async function readSelected() {
    if (!role || !selectedId) return;
    setReading(true);
    setError(null);
    setSavedNote(null);
    try {
      const response = await requestJson<{ saved: boolean; review: NameplateReview }>(
        `/api/installed-systems/${systemId}/nameplate`,
        { method: "POST", role, body: { photoId: selectedId } },
      );
      const next = response.review;
      setReview(next);
      if (next.status === "proposed") {
        setDraftModel(next.modelNumber ?? "");
        setDraftSerial(next.serialNumber ?? "");
      } else {
        setDraftModel("");
        setDraftSerial("");
      }
    } catch (readError) {
      setReview(null);
      setError(readError instanceof Error ? readError.message : "This photo could not be read.");
    } finally {
      setReading(false);
    }
  }

  async function confirmSave() {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/installed-systems/${systemId}/nameplate`, {
        method: "POST",
        role,
        body: { confirm: true, modelNumber: draftModel, serialNumber: draftSerial },
      });
      setReview(null);
      setSavedNote("Saved. Model and serial now match what you confirmed.");
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof ApiRequestError
        ? saveError.message
        : saveError instanceof Error
          ? saveError.message
          : "Nothing was saved.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const selected = photos.find((photo) => photo.id === selectedId) ?? null;

  return (
    <SurfaceCard>
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <ScanLine className="h-4 w-4 text-blue-300" />
          Nameplate photo
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload a photo of the nameplate, then read the model and serial. Loop shows a suggestion
          and saves it only after you confirm.
        </p>
      </div>

      <div className="space-y-4 p-6">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {savedNote ? <p className="text-sm text-emerald-200">{savedNote}</p> : null}

        <PermissionGuard table="installed_systems" action="update">
          <div className="flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                className="sr-only"
                accept={NAMEPLATE_PHOTO_ACCEPT}
                disabled={uploading}
                onChange={(event) => {
                  const input = event.target;
                  onPick(input.files);
                  input.value = "";
                }}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]">
              <Camera className="h-4 w-4" />
              <span className="sr-only">Take nameplate photo</span>
              <input
                type="file"
                className="sr-only"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => {
                  const input = event.target;
                  onPick(input.files);
                  input.value = "";
                }}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            JPEG, PNG, WebP, or HEIC · max {formatFileSize(MAX_JOB_FILE_SIZE_BYTES)}
          </p>
        </PermissionGuard>

        {!loading && photos.length === 0 ? (
          <p className="text-sm text-slate-500">No nameplate photo uploaded yet.</p>
        ) : null}

        {photos.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Installed system photos">
            {photos.map((photo) => {
              const isSelected = photo.id === selectedId;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    className={`block aspect-square w-full overflow-hidden rounded-xl border bg-white/[0.04] ${
                      isSelected ? "border-blue-400/70" : "border-white/10"
                    }`}
                    onClick={() => {
                      setSelectedId(photo.id);
                      setReview(null);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select ${photo.fileName}`}
                  >
                    {photo.previewUrl ? (
                      // Signed storage URLs expire and are not on a fixed image host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-400">
                        {photo.fileName}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <PermissionGuard table="installed_systems" action="update">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!selected || reading || uploading}
            onClick={() => void readSelected()}
          >
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Read model and serial
          </Button>
        </PermissionGuard>

        {review?.status === "unreadable" ? (
          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
            {review.message}
          </p>
        ) : null}

        {review?.status === "proposed" ? (
          <PermissionGuard table="installed_systems" action="update">
            <form
              className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmSave();
              }}
            >
              <p className="text-sm text-slate-300" role="status">{review.message}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-200">Model</span>
                  {modelNumber ? (
                    <span className="block text-xs text-slate-500">Current: {modelNumber}</span>
                  ) : null}
                  <input
                    value={draftModel}
                    onChange={(event) => setDraftModel(event.target.value)}
                    aria-label="Suggested model number"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                  />
                  {review.modelFromPhoto ? (
                    <span className="block text-xs text-slate-500">Suggested from the photo.</span>
                  ) : null}
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-200">Serial</span>
                  {serialNumber ? (
                    <span className="block text-xs text-slate-500">Current: {serialNumber}</span>
                  ) : null}
                  <input
                    value={draftSerial}
                    onChange={(event) => setDraftSerial(event.target.value)}
                    aria-label="Suggested serial number"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                  />
                  {review.serialFromPhoto ? (
                    <span className="block text-xs text-slate-500">Suggested from the photo.</span>
                  ) : null}
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" disabled={saving || !draftModel.trim() || !draftSerial.trim()}>
                  {saving ? "Saving…" : "Save model and serial"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-slate-400 transition hover:text-slate-200"
                  onClick={() => setReview(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </PermissionGuard>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
