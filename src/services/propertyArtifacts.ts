import "server-only";

import {
  listAllPropertyDocuments,
  listAllPropertyPhotos,
  listPropertyDocuments,
  listPropertyPhotos,
} from "@/repositories/propertyArtifacts";

export { type PropertyDocumentRecord, type PropertyPhotoRecord } from "@/repositories/propertyArtifacts";

export async function getPropertyArtifacts(propertyId: string) {
  const [documents, photos] = await Promise.all([
    listPropertyDocuments(propertyId),
    listPropertyPhotos(propertyId),
  ]);

  return { documents, photos };
}

export async function getAllPropertyArtifacts() {
  const [documents, photos] = await Promise.all([
    listAllPropertyDocuments(),
    listAllPropertyPhotos(),
  ]);

  return { documents, photos };
}
