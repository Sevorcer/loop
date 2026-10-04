import "server-only";

import type {
  PropertyDocumentItem,
  PropertyPhotoItem,
} from "@/features/properties/types/propertyDetails";

import { getRepositoryContext } from "./supabaseContext";

interface PropertyDocumentRow {
  id: string;
  property_id: string;
  title: string;
  category: string;
  uploaded_at: string;
  status: PropertyDocumentItem["status"];
}

interface PropertyPhotoRow {
  id: string;
  property_id: string;
  title: string;
  category: string;
  captured_at: string;
  status: PropertyPhotoItem["status"];
}

export interface PropertyDocumentRecord extends PropertyDocumentItem {
  propertyId: string;
}

export interface PropertyPhotoRecord extends PropertyPhotoItem {
  propertyId: string;
}

function mapPropertyDocument(row: PropertyDocumentRow): PropertyDocumentRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    category: row.category,
    uploadedAt: row.uploaded_at,
    status: row.status,
  };
}

function mapPropertyPhoto(row: PropertyPhotoRow): PropertyPhotoRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    title: row.title,
    category: row.category,
    capturedAt: row.captured_at,
    status: row.status,
  };
}

export async function listPropertyDocuments(
  propertyId: string,
  options?: { page?: number; pageSize?: number },
): Promise<PropertyDocumentRecord[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("property_documents")
    .select("id,property_id,title,category,uploaded_at,status")
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .order("uploaded_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list property documents: ${error.message}`);
  }

  return ((data ?? []) as PropertyDocumentRow[]).map(mapPropertyDocument);
}

export async function listPropertyPhotos(
  propertyId: string,
  options?: { page?: number; pageSize?: number },
): Promise<PropertyPhotoRecord[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("property_photos")
    .select("id,property_id,title,category,captured_at,status")
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .order("captured_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list property photos: ${error.message}`);
  }

  return ((data ?? []) as PropertyPhotoRow[]).map(mapPropertyPhoto);
}

export async function listAllPropertyDocuments(
  options?: { page?: number; pageSize?: number },
): Promise<PropertyDocumentRecord[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("property_documents")
    .select("id,property_id,title,category,uploaded_at,status")
    .eq("org_id", orgId)
    .order("uploaded_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list all property documents: ${error.message}`);
  }

  return ((data ?? []) as PropertyDocumentRow[]).map(mapPropertyDocument);
}

export async function listAllPropertyPhotos(
  options?: { page?: number; pageSize?: number },
): Promise<PropertyPhotoRecord[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("property_photos")
    .select("id,property_id,title,category,captured_at,status")
    .eq("org_id", orgId)
    .order("captured_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list all property photos: ${error.message}`);
  }

  return ((data ?? []) as PropertyPhotoRow[]).map(mapPropertyPhoto);
}
