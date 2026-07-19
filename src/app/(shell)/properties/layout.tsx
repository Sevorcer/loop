import type { ReactNode } from "react";

import { PropertiesProvider } from "@/features/properties/state/PropertiesProvider";

export default function PropertiesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PropertiesProvider>{children}</PropertiesProvider>;
}
