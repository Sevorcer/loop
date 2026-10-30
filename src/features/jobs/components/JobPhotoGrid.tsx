"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { jobPhotoPreviews } from "@/features/jobs/utils/jobPhotoPreviews";

export interface JobPhotoPreview {
  id: string;
  fileName: string;
  mimeType: string;
  previewUrl?: string | null;
}

export function JobPhotoGrid({ photos }: { photos: JobPhotoPreview[] }) {
  const previews = jobPhotoPreviews(photos);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = previews.find((photo) => photo.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (previews.length === 0) return null;

  return (
    <>
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Job photos">
        {previews.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              className="block aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
              onClick={() => setOpenId(photo.id)}
              aria-label={`View ${photo.fileName}`}
            >
              <img
                src={photo.previewUrl ?? undefined}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {open?.previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={open.fileName}
          onClick={() => setOpenId(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
            onClick={() => setOpenId(null)}
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={open.previewUrl}
            alt={open.fileName}
            className="max-h-[85vh] w-full max-w-4xl rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
