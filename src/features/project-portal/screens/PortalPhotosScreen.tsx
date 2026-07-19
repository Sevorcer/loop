"use client";

import { usePortal } from "../state/PortalProvider";
import { PortalEmptyState } from "../components/PortalErrorState";
import { PhotoGallery } from "../components/PhotoGallery";

export function PortalPhotosScreen() {
  const { photos, permissions, project } = usePortal();

  if (!permissions?.canViewPhotos || !project?.photosEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-white">Photos</h1>
        <PortalEmptyState
          heading="Photos not available."
          body="Photo sharing is not enabled for this project. Contact your contractor for more information."
          ctaLabel="Contact Team"
          ctaHref="contact"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Photos</h1>
        <p className="mt-1 text-sm text-slate-400">
          Progress photos from your project
        </p>
      </div>

      <PhotoGallery photos={photos} />
    </div>
  );
}
