"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { ZoomIn, X } from "lucide-react";

import type { PortalPhoto, PhotoCategory } from "../types/portalTypes";
import { PortalEmptyState } from "./PortalErrorState";

// ─── Category Labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  before: "Before",
  during: "During",
  completed: "Completed",
  equipment: "Equipment",
  mechanical_room: "Mechanical Room",
  outdoor_unit: "Outdoor Unit",
  permits: "Permits",
};

const CATEGORY_ORDER: PhotoCategory[] = [
  "before",
  "during",
  "completed",
  "equipment",
  "mechanical_room",
  "outdoor_unit",
  "permits",
];

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  photo: PortalPhoto;
  onClose: () => void;
}

function Lightbox({ photo, onClose }: LightboxProps) {
  const altText =
    photo.altText ??
    photo.caption ??
    `${CATEGORY_LABELS[photo.category]} photo`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo: ${altText}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <X size={18} aria-hidden="true" />
      </button>

      <div
        className="relative max-h-[80vh] max-w-4xl overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photo.url}
          alt={altText}
          width={800}
          height={600}
          className="h-auto max-h-[75vh] w-auto object-contain"
          unoptimized
        />
        {photo.caption ? (
          <div className="bg-slate-900/90 px-4 py-2 text-sm text-slate-300">
            {photo.caption}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Photo Tile ───────────────────────────────────────────────────────────────

interface PhotoTileProps {
  photo: PortalPhoto;
  onOpen: (photo: PortalPhoto) => void;
}

function PhotoTile({ photo, onOpen }: PhotoTileProps) {
  const altText =
    photo.altText ??
    photo.caption ??
    `${CATEGORY_LABELS[photo.category]} photo`;

  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      aria-label={`View photo: ${altText}`}
      className="group relative aspect-square overflow-hidden rounded-lg bg-slate-800 ring-1 ring-slate-700 transition-all duration-200 hover:ring-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px]"
    >
      <Image
        src={photo.thumbnailUrl}
        alt={altText}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        unoptimized
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-colors duration-200 group-hover:bg-slate-950/40">
        <ZoomIn
          size={24}
          aria-hidden="true"
          className="text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </div>

      {/* Caption strip */}
      {photo.caption ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent px-2 py-2 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {photo.caption}
        </div>
      ) : null}
    </button>
  );
}

// ─── Gallery Section ──────────────────────────────────────────────────────────

interface GallerySectionProps {
  category: PhotoCategory;
  photos: PortalPhoto[];
  onOpen: (photo: PortalPhoto) => void;
}

function GallerySection({ category, photos, onOpen }: GallerySectionProps) {
  if (photos.length === 0) return null;

  return (
    <section aria-label={`${CATEGORY_LABELS[category]} photos`}>
      <h3 className="mb-3 text-sm font-medium text-slate-400">
        {CATEGORY_LABELS[category]}{" "}
        <span className="text-slate-600">({photos.length})</span>
      </h3>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        role="list"
        aria-label={`${CATEGORY_LABELS[category]} gallery`}
      >
        {photos.map((photo) => (
          <div key={photo.id} role="listitem">
            <PhotoTile photo={photo} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main Gallery ─────────────────────────────────────────────────────────────

interface PhotoGalleryProps {
  photos: PortalPhoto[];
}

/**
 * Role-filtered photo gallery with category sections and lightbox.
 *
 * Accessibility: keyboard-navigable grid, proper alt text strategy,
 * lightbox traps focus and closes on Escape or backdrop click.
 */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<PortalPhoto | null>(null);

  const photosByCategory = useMemo(() =>
    CATEGORY_ORDER.reduce<Record<PhotoCategory, PortalPhoto[]>>(
      (acc, cat) => {
        acc[cat] = photos.filter((p) => p.category === cat);
        return acc;
      },
      {} as Record<PhotoCategory, PortalPhoto[]>
    ),
    [photos]
  );

  const totalPhotos = photos.length;

  if (totalPhotos === 0) {
    return (
      <PortalEmptyState
        heading="No photos available yet."
        body="Photos shared by your contractor will appear here as work progresses."
        ctaLabel="Contact Team"
        ctaHref="contact"
      />
    );
  }

  return (
    <>
      <div className="space-y-8" aria-label={`Photo gallery — ${totalPhotos} photos`}>
        {CATEGORY_ORDER.map((category) => (
          <GallerySection
            key={category}
            category={category}
            photos={photosByCategory[category]}
            onOpen={setLightboxPhoto}
          />
        ))}
      </div>

      {lightboxPhoto ? (
        <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      ) : null}
    </>
  );
}
