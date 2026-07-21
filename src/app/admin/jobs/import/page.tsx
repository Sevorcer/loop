import { ImportScreen } from "@/features/admin/screens/ImportScreen";

export default function ImportJobsPage() {
  return (
    <ImportScreen
      entity="jobs"
      title="Import Jobs"
      description="Bulk-import job records from a CSV file. Validate first with a dry run, then commit when ready."
      csvInstructions={
        "Required columns: title, customerName, propertyName. " +
        "Optional: type (Install | Service | Maintenance | Inspection, default: Service), " +
        "status (Scheduled | In Progress | On Hold | Completed | Cancelled, default: Scheduled), " +
        "priority (Low | Medium | High, default: Medium), " +
        "assignedTo, scheduledFor (YYYY-MM-DD), summary, location, notes. " +
        "First row must be a header row. Column names are case-insensitive."
      }
    />
  );
}
