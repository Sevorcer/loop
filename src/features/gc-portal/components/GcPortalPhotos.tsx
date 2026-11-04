"use client";

import type { PortalPhoto } from "../types/gcPortal";

interface GcPortalPhotosProps {
  photos: PortalPhoto[];
}

export function GcPortalPhotos({ photos }: GcPortalPhotosProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface transition-all hover:border-primary/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? "Job photo"}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          {photo.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
              <p className="text-xs text-white">{photo.caption}</p>
            </div>
          )}
        </a>
      ))}
    </div>
  );
}
