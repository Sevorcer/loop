import type { ReactNode } from "react";

import { redirectTechFromOfficePath } from "@/lib/auth/requireRouteRole";
import { ROUTES } from "@/lib/routes";

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  await redirectTechFromOfficePath(ROUTES.CUSTOMERS);
  return <>{children}</>;
}
