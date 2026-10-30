export function isJobPhotoMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export function jobPhotoPreviews<T extends { mimeType: string; previewUrl?: string | null }>(
  files: T[],
): T[] {
  return files.filter((file) => isJobPhotoMime(file.mimeType) && Boolean(file.previewUrl));
}
