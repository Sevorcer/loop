import type { ReactNode } from "react";

import { ContractorsProvider } from "@/features/contractors/state/ContractorsProvider";

export default function ContractorsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ContractorsProvider>{children}</ContractorsProvider>;
}
