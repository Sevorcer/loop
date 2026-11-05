import type { ReactNode } from "react";

import { PageHeader } from "@/components/atlas/PageHeader";

import { InventoryTabs } from "./InventoryTabs";

interface InventoryFrameProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Shared shell for every inventory screen: header, section tabs, content. */
export function InventoryFrame({ title, description, actions, children }: InventoryFrameProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      <InventoryTabs />
      {children}
    </div>
  );
}
