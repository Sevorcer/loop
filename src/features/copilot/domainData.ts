import { mockKnowledgeItems } from "@/features/company-brain/data/mockKnowledgeItems";
import { mockCustomers } from "@/features/customers/data/mockCustomers";
import { equipmentCatalog } from "@/features/installed-systems/data/equipmentCatalog";
import { seedInstalledSystems } from "@/features/installed-systems/data/seedInstalledSystems";
import { mockJobs } from "@/features/jobs/data/mockJobs";
import {
  fakeDocumentsProjectionRecords,
  fakePhotosProjectionRecords,
} from "@/features/project-portal/data/fakePortalArtifacts";
import { mockPortalProjects } from "@/features/project-portal/data/mockPortalProjects";
import { mockProperties } from "@/features/properties/data/mockProperties";
import { mockPropertyDetails } from "@/features/properties/data/mockPropertyDetails";
import { mockPerformanceModels } from "@/features/reporting/data/mockReporting";
import { listCustomers } from "@/services/customers";
import { listJobsWithActivity } from "@/services/jobs";
import { listProperties } from "@/services/properties";
import { PORTAL_ROUTES, ROUTES, ROUTE_BUILDERS } from "@/lib/routes";

import type { SearchRecord } from "./types";

const NAVIGATION_TARGETS: Array<{ label: string; href: string; aliases: string[] }> = [
  { label: "Dashboard", href: ROUTES.DASHBOARD, aliases: ["dashboard", "home"] },
  { label: "Daily Plans", href: ROUTES.DAILY_PLANS, aliases: ["daily plans", "plan"] },
  { label: "Dispatch", href: ROUTES.DISPATCH, aliases: ["dispatch", "schedule"] },
  { label: "Jobs", href: ROUTES.JOBS, aliases: ["jobs", "work orders"] },
  { label: "Properties", href: ROUTES.PROPERTIES, aliases: ["properties", "sites"] },
  { label: "Customers", href: ROUTES.CUSTOMERS, aliases: ["customers", "accounts"] },
  { label: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, aliases: ["installed systems", "systems"] },
  { label: "Inventory", href: ROUTES.INVENTORY, aliases: ["inventory", "materials"] },
  { label: "Company Brain", href: ROUTES.COMPANY_BRAIN, aliases: ["company brain", "knowledge"] },
  { label: "Reporting", href: ROUTES.REPORTING, aliases: ["reporting", "reports"] },
  { label: "Project Portal", href: PORTAL_ROUTES.ROOT, aliases: ["portal", "projects"] },
];

function sanitizeTokenStrings(value: Array<string | null | undefined>) {
  return value.reduce<string[]>((result, entry) => {
    if (!entry) {
      return result;
    }

    const trimmed = entry.trim();
    if (trimmed) {
      result.push(trimmed);
    }

    return result;
  }, []);
}

export function getFallbackSearchRecords(): SearchRecord[] {
  const jobRecords: SearchRecord[] = mockJobs.map((job) => ({
    id: `job-${job.id}`,
    title: `${job.jobNumber} · ${job.title}`,
    subtitle: `${job.propertyName} • ${job.customerName}`,
    domain: "jobs",
    sourceLabel: "Jobs",
    href: ROUTE_BUILDERS.JOB_DETAIL(job.id),
    recordType: "entity",
    tokens: sanitizeTokenStrings([job.jobNumber, job.title, job.customerName, job.propertyName, job.location, job.type, job.status]),
    contextRefs: { jobId: job.id },
  }));

  const propertyRecords: SearchRecord[] = mockProperties.map((property) => ({
    id: `property-${property.id}`,
    title: property.name,
    subtitle: `${property.address}, ${property.city}`,
    domain: "properties",
    sourceLabel: "Properties",
    href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
    recordType: "entity",
    tokens: sanitizeTokenStrings([property.name, property.customer, property.address, property.city, property.primarySystem]),
    contextRefs: { propertyId: property.id },
  }));

  const customerRecords: SearchRecord[] = mockCustomers.map((customer) => ({
    id: `customer-${customer.id}`,
    title: customer.name,
    subtitle: `${customer.primaryContact} • ${customer.city}`,
    domain: "customers",
    sourceLabel: "Customers",
    href: ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id),
    recordType: "entity",
    tokens: sanitizeTokenStrings([customer.name, customer.primaryContact, customer.city, customer.email, customer.phone]),
    contextRefs: { customerId: customer.id },
  }));

  return buildStaticSearchRecords([...jobRecords, ...propertyRecords, ...customerRecords]);
}

function buildStaticSearchRecords(liveRecords: SearchRecord[]): SearchRecord[] {
  const projectRecords: SearchRecord[] = mockPortalProjects.map((project) => ({
    id: `project-${project.id}`,
    title: project.name,
    subtitle: `${project.status.replaceAll("_", " ")} • ${project.projectManager}`,
    domain: "projects",
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.PROJECT(project.id),
    recordType: "entity",
    tokens: sanitizeTokenStrings([project.name, project.address, project.projectManager, project.nextMilestone]),
    contextRefs: { projectId: project.id },
  }));

  const reportRecords: SearchRecord[] = mockPerformanceModels.map((model) => ({
    id: `report-${model.id}`,
    title: model.title,
    subtitle: model.description,
    domain: "reports",
    sourceLabel: "Reporting",
    href: ROUTES.REPORTING,
    recordType: "report",
    tokens: sanitizeTokenStrings([model.title, model.description, ...model.relatedDomains]),
  }));

  const knowledgeRecords: SearchRecord[] = mockKnowledgeItems.map((item) => ({
    id: `knowledge-${item.id}`,
    title: item.title,
    subtitle: item.summary,
    domain: "company_brain",
    sourceLabel: "Company Brain",
    href: ROUTES.COMPANY_BRAIN,
    recordType: "document",
    tokens: sanitizeTokenStrings([item.title, item.summary, item.body, ...item.tags, ...item.relatedDomains]),
  }));

  const manualRecords: SearchRecord[] = equipmentCatalog.flatMap((entry) => {
    const manualId = `manual-${entry.id}`;
    const submittalId = `submittal-${entry.id}`;

    return [
      {
        id: manualId,
        title: entry.documents.manual,
        subtitle: `${entry.manufacturer} ${entry.modelNumber}`,
        domain: "documents" as const,
        sourceLabel: "Installed Systems",
        href: ROUTES.INSTALLED_SYSTEMS,
        recordType: "manual" as const,
        tokens: sanitizeTokenStrings([
          entry.documents.manual,
          entry.manufacturer,
          entry.modelNumber,
          entry.equipmentType,
          ...(entry.matchedAliases ?? []),
        ]),
      },
      {
        id: submittalId,
        title: entry.documents.submittal,
        subtitle: `${entry.manufacturer} ${entry.modelNumber}`,
        domain: "documents" as const,
        sourceLabel: "Installed Systems",
        href: ROUTES.INSTALLED_SYSTEMS,
        recordType: "manual" as const,
        tokens: sanitizeTokenStrings([
          entry.documents.submittal,
          entry.manufacturer,
          entry.modelNumber,
          entry.equipmentType,
          ...(entry.matchedAliases ?? []),
        ]),
      },
    ];
  });

  const installedSystemRecords: SearchRecord[] = seedInstalledSystems.map((system) => ({
    id: `system-${system.id}`,
    title: system.systemName,
    subtitle: `${system.propertyName} • ${system.lifecycleStatus}`,
    domain: "installed_systems",
    sourceLabel: "Installed Systems",
    href: ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id),
    recordType: "entity",
    tokens: sanitizeTokenStrings([system.systemName, system.customerName, system.propertyName, system.location, ...(system.serialNumbers ?? [])]),
    contextRefs: {
      installedSystemId: system.id,
      propertyId: system.propertyId,
      jobId: system.jobId,
    },
  }));

  const propertyDocumentRecords: SearchRecord[] = mockPropertyDetails.flatMap((detail) =>
    detail.documents.map((document) => ({
      id: `property-document-${document.id}`,
      title: document.title,
      subtitle: `${document.category} • ${detail.propertyId}`,
      domain: "documents" as const,
      sourceLabel: "Properties",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(detail.propertyId),
      recordType: "document" as const,
      tokens: sanitizeTokenStrings([document.title, document.category, document.status, detail.propertyId]),
      contextRefs: { propertyId: detail.propertyId },
    })),
  );

  const propertyPhotoRecords: SearchRecord[] = mockPropertyDetails.flatMap((detail) =>
    detail.photos.map((photo) => ({
      id: `property-photo-${photo.id}`,
      title: photo.title,
      subtitle: `${photo.category} • ${detail.propertyId}`,
      domain: "photos" as const,
      sourceLabel: "Properties",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(detail.propertyId),
      recordType: "photo" as const,
      tokens: sanitizeTokenStrings([photo.title, photo.category, photo.status, detail.propertyId]),
      contextRefs: { propertyId: detail.propertyId },
    })),
  );

  const portalDocumentRecords: SearchRecord[] = fakeDocumentsProjectionRecords.map((document) => ({
    id: `portal-document-${document.documentId}`,
    title: document.title,
    subtitle: `${document.category} • Portal project ${document.projectId}`,
    domain: "documents",
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.DOCUMENTS(document.projectId),
    recordType: "document",
    tokens: sanitizeTokenStrings([document.title, document.category, document.visibility, document.projectId]),
    contextRefs: { projectId: document.projectId },
  }));

  const portalPhotoRecords: SearchRecord[] = fakePhotosProjectionRecords.map((photo) => ({
    id: `portal-photo-${photo.photoId}`,
    title: photo.caption,
    subtitle: `Portal project ${photo.projectId}`,
    domain: "photos",
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.PHOTOS(photo.projectId),
    recordType: "photo",
    tokens: sanitizeTokenStrings([photo.caption, photo.projectId, photo.customerVisible ? "customer" : "internal"]),
    contextRefs: { projectId: photo.projectId },
  }));

  const navigationRecords: SearchRecord[] = NAVIGATION_TARGETS.map((target) => ({
    id: `navigation-${target.href}`,
    title: target.label,
    subtitle: `Navigate to ${target.label}`,
    domain: "navigation",
    sourceLabel: "Navigation",
    href: target.href,
    recordType: "navigation",
    tokens: sanitizeTokenStrings([target.label, ...target.aliases]),
  }));

  return [
    ...liveRecords,
    ...projectRecords,
    ...reportRecords,
    ...knowledgeRecords,
    ...manualRecords,
    ...installedSystemRecords,
    ...propertyDocumentRecords,
    ...propertyPhotoRecords,
    ...portalDocumentRecords,
    ...portalPhotoRecords,
    ...navigationRecords,
  ];
}

export async function getSearchRecords(): Promise<SearchRecord[]> {
  const [{ jobs }, properties, customers] = await Promise.all([
    listJobsWithActivity(),
    listProperties(),
    listCustomers(),
  ]);

  const liveRecords: SearchRecord[] = [
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${job.jobNumber} · ${job.title}`,
      subtitle: `${job.propertyName} • ${job.customerName}`,
      domain: "jobs" as const,
      sourceLabel: "Jobs",
      href: ROUTE_BUILDERS.JOB_DETAIL(job.id),
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([job.jobNumber, job.title, job.customerName, job.propertyName, job.location, job.type, job.status]),
      contextRefs: { jobId: job.id },
    })),
    ...properties.map((property) => ({
      id: `property-${property.id}`,
      title: property.name,
      subtitle: `${property.address}, ${property.city}`,
      domain: "properties" as const,
      sourceLabel: "Properties",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([property.name, property.customer, property.address, property.city, property.primarySystem]),
      contextRefs: { propertyId: property.id },
    })),
    ...customers.map((customer) => ({
      id: `customer-${customer.id}`,
      title: customer.name,
      subtitle: `${customer.primaryContact} • ${customer.city}`,
      domain: "customers" as const,
      sourceLabel: "Customers",
      href: ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id),
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([customer.name, customer.primaryContact, customer.city, customer.email, customer.phone]),
      contextRefs: { customerId: customer.id },
    })),
  ];

  return buildStaticSearchRecords(liveRecords);
}
