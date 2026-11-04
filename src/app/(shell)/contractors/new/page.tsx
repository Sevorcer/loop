import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";
import { NewContractorForm } from "@/features/contractors";

export const dynamic = "force-dynamic";

export default async function NewContractorPage() {
  await redirectTechFromOfficePath(ROUTES.CONTRACTORS);
  return <NewContractorForm />;
}
