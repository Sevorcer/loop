import type { DriveManualFile } from "../types/manuals";
import { MANUAL_DOC_TYPE_LABELS } from "../types/manuals";

/** Case-insensitive filter across name, folder, brand, models and type. */
export function filterDriveManuals(files: DriveManualFile[], query: string, manufacturer = ""): DriveManualFile[] {
  const q = query.trim().toLowerCase();
  const brand = manufacturer.trim().toLowerCase();
  return files.filter((file) => {
    if (brand && (file.manufacturer ?? "").toLowerCase() !== brand) return false;
    if (!q) return true;
    const haystack = [
      file.name,
      file.folderPath,
      file.manufacturer ?? "",
      ...file.parsedManufacturers,
      ...file.models,
      MANUAL_DOC_TYPE_LABELS[file.docType],
    ]
      .join(" ")
      .toLowerCase();
    return q.split(/\s+/).every((part) => haystack.includes(part));
  });
}

/** Brand → file count, most files first (for the filter chips). */
export function manufacturerCounts(files: DriveManualFile[]): Array<{ manufacturer: string; count: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (!file.manufacturer) continue;
    counts.set(file.manufacturer, (counts.get(file.manufacturer) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([manufacturer, count]) => ({ manufacturer, count }))
    .sort((a, b) => b.count - a.count || a.manufacturer.localeCompare(b.manufacturer));
}

export function fileKindLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/vnd.google-apps.document") return "Google Doc";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Google Sheet";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "Spreadsheet";
  return "File";
}
