import { PortalErrorState } from "@/features/project-portal/components/PortalErrorState";

export default function NotFoundPage() {
  return <PortalErrorState code="missing_project" />;
}
