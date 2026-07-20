import type { CopilotResolvedContext, CopilotSearchContextInput } from "./types";

const DEFAULT_PATHNAME = "/dashboard";

function cleanSegments(pathname: string) {
  return pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
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

  if (segments[0] === "jobs" && segments[1] && segments[1] !== "new") {
    resolved.jobId = resolved.jobId ?? segments[1];
    resolved.stage = segments[2];
    return resolved;
  }

  if (segments[0] === "properties" && segments[1] && segments[1] !== "new") {
    resolved.propertyId = resolved.propertyId ?? segments[1];
    resolved.stage = segments[2];
    return resolved;
  }

  if (segments[0] === "customers" && segments[1] && segments[1] !== "new") {
    resolved.customerId = resolved.customerId ?? segments[1];
    resolved.stage = segments[2];
    return resolved;
  }

  if (segments[0] === "installed-systems" && segments[1]) {
    resolved.installedSystemId = resolved.installedSystemId ?? segments[1];
    resolved.stage = segments[2];
    return resolved;
  }

  if (segments[0] === "portal" && segments[1] && segments[1] !== "error") {
    resolved.projectId = resolved.projectId ?? segments[1];
    resolved.stage = segments[2];
    return resolved;
  }

  resolved.stage = segments[1];
  return resolved;
}
