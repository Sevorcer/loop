import type { ImportNote } from "./plan";

export interface CustomerLink {
  loopCustomerId: string;
  sfCustomerId: number;
}

export interface ExistingLoopCustomer {
  id: string;
  sfId: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read a link file. The header must include loop_customer_id and sf_customer_id.
 * Throws when a row is not an id, so a bad file is fixed before any write.
 */
export function parseCustomerLinkCsv(text: string): CustomerLink[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const filled = lines
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((entry) => entry.line.length > 0 && !entry.line.startsWith("#"));
  if (filled.length === 0) {
    throw new Error("The customer link file is empty.");
  }
  const header = splitCsv(filled[0].line).map((cell) => cell.trim().toLowerCase());
  const loopIndex = header.indexOf("loop_customer_id");
  const sfIndex = header.indexOf("sf_customer_id");
  if (loopIndex < 0 || sfIndex < 0) {
    throw new Error("The customer link file needs columns loop_customer_id and sf_customer_id.");
  }

  const links: CustomerLink[] = [];
  const seenSf = new Set<number>();
  for (const entry of filled.slice(1)) {
    const cells = splitCsv(entry.line);
    const loopCustomerId = (cells[loopIndex] ?? "").trim();
    const sfText = (cells[sfIndex] ?? "").trim();
    if (!UUID.test(loopCustomerId)) {
      throw new Error(`Line ${entry.number}: loop_customer_id is not an id.`);
    }
    if (!/^\d+$/.test(sfText) || Number(sfText) <= 0) {
      throw new Error(`Line ${entry.number}: sf_customer_id is not a Service Fusion id.`);
    }
    const sfCustomerId = Number(sfText);
    if (seenSf.has(sfCustomerId)) {
      throw new Error(`Line ${entry.number}: sf_customer_id ${sfCustomerId} is listed twice.`);
    }
    seenSf.add(sfCustomerId);
    links.push({ loopCustomerId, sfCustomerId });
  }
  return links;
}

export interface CustomerClassCounts {
  insert: number;
  update: number;
  link: number;
}

/**
 * Decide which Service Fusion customers adopt an existing Loop row.
 * A link is used only when that Loop customer exists and does not already
 * point at a different Service Fusion id, and no other row already has this id.
 */
export function classifyCustomerRows(
  sfIds: readonly number[],
  links: readonly CustomerLink[],
  existing: readonly ExistingLoopCustomer[] | null,
): { counts: CustomerClassCounts; ready: CustomerLink[]; notices: ImportNote[] } {
  const wanted = new Map(links.map((link) => [link.sfCustomerId, link]));
  const notices: ImportNote[] = [];
  const ready: CustomerLink[] = [];
  const counts: CustomerClassCounts = { insert: 0, update: 0, link: 0 };

  const byId = new Map((existing ?? []).map((row) => [row.id, row]));
  const bySfId = new Map<number, ExistingLoopCustomer>();
  for (const row of existing ?? []) {
    if (row.sfId != null) bySfId.set(row.sfId, row);
  }

  for (const sfId of sfIds) {
    const link = wanted.get(sfId);
    if (!link) {
      if (existing && bySfId.has(sfId)) counts.update += 1;
      else counts.insert += 1;
      continue;
    }
    if (!existing) {
      counts.link += 1;
      ready.push(link);
      continue;
    }
    const loopRow = byId.get(link.loopCustomerId);
    const holder = bySfId.get(sfId);
    if (!loopRow) {
      notices.push({ table: "customers", sfId: String(sfId), reason: "customer_link_missing" });
      if (holder) counts.update += 1;
      else counts.insert += 1;
      continue;
    }
    if (holder && holder.id !== loopRow.id) {
      notices.push({ table: "customers", sfId: String(sfId), reason: "customer_link_taken" });
      counts.update += 1;
      continue;
    }
    if (loopRow.sfId != null && loopRow.sfId !== sfId) {
      notices.push({ table: "customers", sfId: String(sfId), reason: "customer_link_conflict" });
      counts.insert += 1;
      continue;
    }
    if (loopRow.sfId === sfId) {
      counts.update += 1;
      continue;
    }
    counts.link += 1;
    ready.push(link);
  }

  for (const link of links) {
    if (!sfIds.includes(link.sfCustomerId)) {
      notices.push({
        table: "customers",
        sfId: String(link.sfCustomerId),
        reason: "customer_link_not_in_import",
      });
    }
  }

  return { counts, ready, notices };
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}
