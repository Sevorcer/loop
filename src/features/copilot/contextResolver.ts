import type { CopilotResolvedContext, CopilotSearchContextInput } from "./types";

const DEFAULT_PATHNAME = "/dashboard";

function cleanSegments(pathname: string) {
  return pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
}

function hydrateEntityContext(
  resolved: CopilotResolvedContext,
  segments: string[],
  config: {
    domain: string;
    idField: "jobId" | "propertyId" | "customerId" | "installedSystemId" | "projectId";
    skipSegment?: string;
  }
) {
  if (segments[0] !== config.domain) {
    return false;
  }

  if (!segments[1] || segments[1] === config.skipSegment) {
    return false;
  }

  resolved[config.idField] = resolved[config.idField] ?? segments[1];
  resolved.stage = segments[2];
  return true;
}

export function resolveCopilotContext(
  context: CopilotSearchContextInput | undefined
): CopilotResolvedContext {
  const pathname = context?.pathname?.trim() || DEFAULT_PATHNAME;
  const segments = cleanSegments(pathname);

  const resolved: CopilotResolvedContext = {
    pathname,
    domain: segments[0],
    projectId: context?.projectId,
    propertyId: context?.propertyId,
    jobId: context?.jobId,
    installedSystemId: context?.installedSystemId,
    customerId: context?.customerId,
  };

  if (
    hydrateEntityContext(resolved, segments, {
      domain: "jobs",
      idField: "jobId",
      skipSegment: "new",
    })
  ) {
    return resolved;
  }

  if (
    hydrateEntityContext(resolved, segments, {
      domain: "properties",
      idField: "propertyId",
      skipSegment: "new",
    })
  ) {
    return resolved;
  }

  if (
    hydrateEntityContext(resolved, segments, {
      domain: "customers",
      idField: "customerId",
      skipSegment: "new",
    })
  ) {
    return resolved;
  }

  if (
    hydrateEntityContext(resolved, segments, {
      domain: "installed-systems",
      idField: "installedSystemId",
    })
  ) {
    return resolved;
  }

  if (
    hydrateEntityContext(resolved, segments, {
      domain: "portal",
      idField: "projectId",
      skipSegment: "error",
    })
  ) {
    return resolved;
  }

  resolved.stage = segments[1];
  return resolved;
}
