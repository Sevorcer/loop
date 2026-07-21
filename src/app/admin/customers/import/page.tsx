import { ImportScreen } from "@/features/admin/screens/ImportScreen";

export default function ImportCustomersPage() {
  return (
    <ImportScreen
      entity="customers"
      title="Import Customers"
      description="Bulk-import customer records from a CSV file. Validate first with a dry run, then commit when ready."
      csvInstructions={
        "Required columns: name, primaryContact, email, phone, city. " +
        "Optional: status (Active | Prospect | Inactive, default: Active). " +
        "First row must be a header row. Column names are case-insensitive."
      }
    />
  );
}
