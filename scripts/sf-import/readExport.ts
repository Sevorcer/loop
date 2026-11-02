import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ExportBundle {
  customers: unknown[];
  jobs: unknown[];
  estimates: unknown[];
  invoices: unknown[];
  equipment: { customerSfId: number; items: unknown[] }[];
  calendarTasks: unknown[];
  techs: unknown[];
  jobsOpenOld: number;
}

export async function readExport(exportDir: string): Promise<ExportBundle> {
  const rawDir = path.join(exportDir, "raw");
  const jobsDir = path.join(rawDir, "jobs");
  try {
    await readdir(jobsDir);
  } catch {
    throw new Error(
      "That folder does not look like a Service Fusion export. It needs a raw/jobs directory.",
    );
  }

  const [customers, jobs, estimates, invoices, calendarTasks, techs, equipment, jobsOpenOld] =
    await Promise.all([
      readPages(path.join(rawDir, "customers")),
      readPages(jobsDir),
      readPages(path.join(rawDir, "estimates")),
      readPages(path.join(rawDir, "invoices")),
      readPages(path.join(rawDir, "calendar-tasks")),
      readPages(path.join(rawDir, "techs")),
      readEquipment(path.join(rawDir, "equipment")),
      countItems(path.join(rawDir, "jobs-open-old")),
    ]);

  return { customers, jobs, estimates, invoices, equipment, calendarTasks, techs, jobsOpenOld };
}

async function readPages(directory: string): Promise<unknown[]> {
  const files = await jsonFiles(directory);
  const items: unknown[] = [];
  for (const file of files) {
    items.push(...itemsFrom(await readJson(file)));
  }
  return items;
}

async function readEquipment(directory: string): Promise<{ customerSfId: number; items: unknown[] }[]> {
  const files = await jsonFiles(directory);
  const groups: { customerSfId: number; items: unknown[] }[] = [];
  for (const file of files) {
    const customerSfId = Number(path.basename(file, ".json"));
    if (!Number.isInteger(customerSfId) || customerSfId <= 0) continue;
    groups.push({ customerSfId, items: itemsFrom(await readJson(file)) });
  }
  return groups;
}

async function countItems(directory: string): Promise<number> {
  const files = await jsonFiles(directory);
  let count = 0;
  for (const file of files) {
    const items = itemsFrom(await readJson(file));
    count += items.length > 0 ? items.length : 1;
  }
  return count;
}

async function jsonFiles(directory: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort()
    .map((name) => path.join(directory, name));
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    throw new Error("A page in the export could not be read. The import stopped before any write.");
  }
}

function itemsFrom(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.equipment)) return record.equipment;
  // A customer equipment file can be one record instead of a page.
  if ("_meta" in record) return [];
  return [parsed];
}
