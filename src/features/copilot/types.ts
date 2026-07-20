export type CopilotIntent =
  | "search"
  | "navigation"
  | "manual_lookup"
  | "photo_lookup"
  | "conversation";

export type CopilotMode = "structured" | "expanded";

export type CopilotDomain =
  | "projects"
  | "properties"
  | "jobs"
  | "documents"
  | "photos"
  | "reports"
  | "company_brain"
  | "installed_systems"
  | "customers"
  | "navigation";

export interface CopilotSearchContextInput {
  pathname?: string;
  projectId?: string;
  propertyId?: string;
  jobId?: string;
  installedSystemId?: string;
  customerId?: string;
}

export interface CopilotResolvedContext {
  pathname: string;
  domain?: string;
  stage?: string;
  projectId?: string;
  propertyId?: string;
  jobId?: string;
  installedSystemId?: string;
  customerId?: string;
}

export interface CopilotSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  domain: CopilotDomain;
  sourceLabel: string;
  href: string;
}

export interface CopilotSearchGroup {
  domain: CopilotDomain;
  label: string;
  items: CopilotSearchItem[];
}

export interface CopilotSearchResponse {
  query: string;
  intent: CopilotIntent;
  mode: CopilotMode;
  context: CopilotResolvedContext;
  groups: CopilotSearchGroup[];
  response?: string;
}

export interface CopilotSearchRequestBody {
  query?: string;
  context?: CopilotSearchContextInput;
}

export interface SearchRecord {
  id: string;
  title: string;
  subtitle?: string;
  domain: CopilotDomain;
  sourceLabel: string;
  href: string;
  tokens: string[];
  recordType:
    | "entity"
    | "manual"
    | "document"
    | "photo"
    | "report"
    | "navigation";
  contextRefs?: {
    projectId?: string;
    propertyId?: string;
    jobId?: string;
    installedSystemId?: string;
    customerId?: string;
  };
}
