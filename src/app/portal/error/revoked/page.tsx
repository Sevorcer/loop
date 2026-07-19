import { PortalErrorState } from "@/features/project-portal/components/PortalErrorState";

export default function RevokedPage() {
  return <PortalErrorState code="revoked_access" />;
}
