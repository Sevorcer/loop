import { notFound } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { KnowledgeItemForm } from "@/features/company-brain/components/KnowledgeItemForm";
import { getKnowledgeItem } from "@/services/knowledgeItems";

interface EditKnowledgeItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditKnowledgeItemPage({
  params,
}: EditKnowledgeItemPageProps) {
  const { id } = await params;
  const item = await getKnowledgeItem(id);

  if (!item) {
    notFound();
  }

  return (
    <RoutePermissionGuard
      table="knowledge_items"
      action="update"
      deniedDescription="You don't have permission to edit knowledge items."
    >
      <KnowledgeItemForm item={item} />
    </RoutePermissionGuard>
  );
}
