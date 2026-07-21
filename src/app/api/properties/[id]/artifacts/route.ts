import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getPropertyArtifacts } from "@/services/propertyArtifacts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const documentsGuard = requirePermission(request, "property_documents", "select");
  if (!documentsGuard.ok) return documentsGuard.response;

  const photosGuard = requirePermission(request, "property_photos", "select");
  if (!photosGuard.ok) return photosGuard.response;

  try {
    const { id } = await params;
    const artifacts = await getPropertyArtifacts(id);
    return NextResponse.json(artifacts);
  } catch (error) {
    return mapRouteError(error);
  }
}
