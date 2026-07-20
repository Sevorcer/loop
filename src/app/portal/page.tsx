import { PortalHomeScreen } from "@/features/project-portal/screens/PortalHomeScreen";
import { getPortalHomeData } from "@/features/project-portal/services/portalHome";

export default function PortalHomePage() {
  const { projects } = getPortalHomeData();

  return <PortalHomeScreen projects={projects} />;
}
