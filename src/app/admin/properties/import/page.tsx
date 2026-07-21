import { ImportScreen } from "@/features/admin/screens/ImportScreen";

export default function ImportPropertiesPage() {
  return (
    <ImportScreen
      entity="properties"
      title="Import Properties"
      description="Bulk-import property records from a CSV file. Validate first with a dry run, then commit when ready."
      csvInstructions={
        "Required columns: name, customer, address, city. " +
        "Optional: type (Residential | Commercial | Multi-Family, default: Residential), " +
        "status (Active | Pending | Inactive, default: Active), primarySystem. " +
        "First row must be a header row. Column names are case-insensitive."
      }
    />
  );
}
