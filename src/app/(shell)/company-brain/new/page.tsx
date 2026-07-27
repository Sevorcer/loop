import { RoutePermissionGuard } from "@/components/atlas";
import { CompanyBrainProvider } from "@/features/company-brain";
import { KnowledgeItemForm } from "@/features/company-brain/components/KnowledgeItemForm";

export default function NewKnowledgeItemPage() {
  return (
    <CompanyBrainProvider>
      <RoutePermissionGuard
        table="knowledge_items"
        action="insert"
        deniedDescription="You don't have permission to create knowledge items."
      >
        <KnowledgeItemForm />
      </RoutePermissionGuard>
    </CompanyBrainProvider>
  );
}
