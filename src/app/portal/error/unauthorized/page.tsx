import { PortalErrorState } from "@/features/project-portal/components/PortalErrorState";

export default function UnauthorizedPage() {
  return <PortalErrorState code="unauthorized" />;
}
