import { getSearchRecords } from "./domainData";
import { resolveCopilotContext } from "./contextResolver";
import { parseCopilotIntent } from "./intentParser";
import { scoreRecord } from "./ranking";
import type {
  CopilotSearchContextInput,
  CopilotSearchGroup,
  CopilotSearchItem,
  CopilotSearchResponse,
} from "./types";
import type { SearchRecord } from "./types";

const GROUP_LABELS: Record<CopilotSearchItem["domain"], string> = {
  projects: "Projects",
  properties: "Properties",
  jobs: "Jobs",
  documents: "Documents",
  photos: "Photos",
  reports: "Reports",
  company_brain: "Company Brain",
  installed_systems: "Installed Systems",
  customers: "Customers",
  navigation: "Navigation",
};

function toGroups(items: CopilotSearchItem[]): CopilotSearchGroup[] {
  const grouped = new Map<CopilotSearchItem["domain"], CopilotSearchItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.domain);
    if (existing) {
      existing.push(item);
      continue;
    }

    grouped.set(item.domain, [item]);
  }

  return Array.from(grouped.entries()).map(([domain, groupItems]) => ({
    domain,
    label: GROUP_LABELS[domain],
    items: groupItems,
  }));
}

function buildConversationalResponse(query: string) {
  return `I can help retrieve items and route you to the right screen for: ${query}`;
}

export async function searchCopilot(
  query: string,
  inputContext?: CopilotSearchContextInput,
  recordsOverride?: SearchRecord[],
): Promise<CopilotSearchResponse> {
  const trimmedQuery = query.trim();
  const intent = parseCopilotIntent(trimmedQuery);
  const context = resolveCopilotContext(inputContext);
  const records = recordsOverride ?? (await getSearchRecords());

  const scored = records
    .map((record) => ({
      record,
      score: scoreRecord(trimmedQuery, intent, context, record),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 20)
    .map<CopilotSearchItem>((entry) => ({
      id: entry.record.id,
      title: entry.record.title,
      subtitle: entry.record.subtitle,
      domain: entry.record.domain,
      sourceLabel: entry.record.sourceLabel,
      href: entry.record.href,
    }));

  const mode = intent === "conversation" ? "expanded" : "structured";

  return {
    query: trimmedQuery,
    intent,
    mode,
    context,
    groups: toGroups(scored),
    response: mode === "expanded" ? buildConversationalResponse(trimmedQuery) : undefined,
  };
}
