import type { ReactNode } from "react";

import { InstalledSystemsProvider } from "@/features/installed-systems/state/InstalledSystemsProvider";

export default function InstalledSystemsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <InstalledSystemsProvider>{children}</InstalledSystemsProvider>;
}
