import type { ReactNode } from "react";

import { InventoryProvider } from "@/features/inventory/state/InventoryProvider";

export default function InventoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <InventoryProvider>{children}</InventoryProvider>;
}
