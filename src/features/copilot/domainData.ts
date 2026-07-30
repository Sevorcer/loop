/**
 * Copilot domain data — Sprint 27 #58
 *
 * LIVE SOURCES (production path via getSearchRecords):
 *   - Customers        → listCustomers() service
 *   - Properties       → listProperties() service
 *   - Jobs             → listJobsWithActivity() service
 *   - Installed Systems→ listInstalledSystems() repository (Sprint 27)
 *   - Knowledge Items  → listKnowledgeItems() repository (Sprint 27)
 *   - Portal Projects  → listPortalProjects() repository (Sprint 27)
 *   - Portal Documents → listAllPortalDocuments() repository (Sprint 27)
 *   - Portal Photos    → listAllPortalPhotos() repository (Sprint 27)
 *   - Performance Models → listPerformanceModels() repository (Sprint 27)
 *
 * STATIC SOURCES (intentional deviations — not user data):
 *   - equipmentCatalog  → HVAC equipment reference catalog (manufacturer specs,
 *                         static product data, not org-specific).
 *                         Deviation rationale: catalog data is configuration, not
 *                         user-generated operational data. No Supabase table needed.
 *   - mockPropertyDetails → fallback-only property document/photo metadata
 *                         used by getFallbackSearchRecords() in test/dev.
 *   - NAVIGATION_TARGETS → pure UI config; no database involvement appropriate.
 *
 * FALLBACK (getFallbackSearchRecords — test/dev only):
 *   Returns records built from mock fixtures. Used by test suite and as a
 *   graceful degradation when Supabase is unavailable.
 *   Mock imports in this function are NOT a production concern.
 */

import { equipmentCatalog } from "@/features/installed-systems/data/equipmentCatalog";
import { mockCustomers } from "@/features/customers/data/mockCustomers";
import { mockJobs } from "@/features/jobs/data/mockJobs";
import { mockProperties } from "@/features/properties/data/mockProperties";
import { mockPropertyDetails } from "@/features/properties/data/mockPropertyDetails";
import { mockKnowledgeItems } from "@/features/company-brain/data/mockKnowledgeItems";
import { seedInstalledSystems } from "@/features/installed-systems/data/seedInstalledSystems";
import {
  fakeDocumentsProjectionRecords,
  fakePhotosProjectionRecords,
} from "@/features/project-portal/data/fakePortalArtifacts";
import { mockPortalProjects } from "@/features/project-portal/data/mockPortalProjects";
import { mockPerformanceModels } from "@/features/reporting/data/mockReporting";

import { listCustomers } from "@/services/customers";
import { listJobsWithActivity } from "@/services/jobs";
import { getAllPropertyArtifacts } from "@/services/propertyArtifacts";
import { listProperties } from "@/services/properties";
import { listInstalledSystems } from "@/repositories/installedSystems";
import { listKnowledgeItems } from "@/repositories/knowledgeItems";
import { listPerformanceModels } from "@/repositories/performanceReporting";
import {
  listPortalProjects,
  listAllPortalDocuments,
  listAllPortalPhotos,
} from "@/repositories/portalProjects";

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
    if (!entry) return result;
    const trimmed = entry.trim();
    if (trimmed) result.push(trimmed);
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
    metadata: {
      badges: [job.type, job.priority],
      status: job.status,
      timestamp: job.scheduledFor ?? undefined,
    },
    recordType: "entity",
    tokens: sanitizeTokenStrings([
      job.jobNumber,
      job.title,
      job.customerName,
      job.propertyName,
      job.location,
      job.type,
      job.status,
    ]),
    contextRefs: { jobId: job.id },
  }));

  const propertyRecords: SearchRecord[] = mockProperties.map((property) => ({
    id: `property-${property.id}`,
    title: property.name,
    subtitle: `${property.address}, ${property.city}`,
    domain: "properties",
    sourceLabel: "Properties",
    href: ROUTE_BUILDERS.PROPERTY_DETAIL(property.id),
    metadata: {
      badges: [property.type, property.primarySystem],
      status: property.status,
      timestamp: property.lastVisit,
    },
    recordType: "entity",
    tokens: sanitizeTokenStrings([
      property.name,
      property.customer,
      property.address,
      property.city,
      property.primarySystem,
    ]),
    contextRefs: { propertyId: property.id },
  }));

  const customerRecords: SearchRecord[] = mockCustomers.map((customer) => ({
    id: `customer-${customer.id}`,
    title: customer.name,
    subtitle: `${customer.primaryContact} • ${customer.city}`,
    domain: "customers",
    sourceLabel: "Customers",
    href: ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id),
    metadata: {
      badges: [`${customer.propertyCount} properties`, `${customer.openJobs} open jobs`],
      status: customer.status,
      timestamp: customer.lastActivity,
    },
    recordType: "entity",
    tokens: sanitizeTokenStrings([
      customer.name,
      customer.primaryContact,
      customer.city,
      customer.email,
      customer.phone,
    ]),
    contextRefs: { customerId: customer.id },
  }));

  return buildStaticSearchRecords([...jobRecords, ...propertyRecords, ...customerRecords]);
}

function buildStaticSearchRecords(liveRecords: SearchRecord[]): SearchRecord[] {
  const projectRecords: SearchRecord[] = mockPortalProjects.map((project) => ({
    id: `project-${project.id}`,
    title: project.name,
    subtitle: `${project.status.replaceAll("_", " ")} • ${project.projectManager}`,
    domain: "projects" as const,
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.PROJECT(project.id),
    recordType: "entity" as const,
    tokens: sanitizeTokenStrings([project.name, project.address, project.projectManager, project.nextMilestone]),
    contextRefs: { projectId: project.id },
  }));

  const reportRecords: SearchRecord[] = mockPerformanceModels.map((model) => ({
    id: `report-${model.id}`,
    title: model.title,
    subtitle: model.description,
    domain: "reports" as const,
    sourceLabel: "Reporting",
    href: ROUTES.REPORTING,
    recordType: "report" as const,
    tokens: sanitizeTokenStrings([model.title, model.description, ...model.relatedDomains]),
  }));

  const knowledgeRecords: SearchRecord[] = mockKnowledgeItems.map((item) => ({
    id: `knowledge-${item.id}`,
    title: item.title,
    subtitle: item.summary,
    domain: "company_brain" as const,
    sourceLabel: "Company Brain",
    href: ROUTE_BUILDERS.COMPANY_BRAIN_EDIT(item.id),
    metadata: {
      badges: [item.knowledgeType, ...item.tags.slice(0, 2)],
      status: item.status,
      timestamp: item.updatedAt,
    },
    recordType: "document" as const,
    tokens: sanitizeTokenStrings([item.title, item.summary, item.body, ...item.tags, ...item.relatedDomains]),
  }));

  const manualRecords: SearchRecord[] = equipmentCatalog.flatMap((entry) => [
    {
      id: `manual-${entry.id}`,
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
      id: `submittal-${entry.id}`,
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
  ]);

  const installedSystemRecords: SearchRecord[] = seedInstalledSystems.map((system) => ({
    id: `system-${system.id}`,
    title: system.systemName,
    subtitle: `${system.propertyName} • ${system.lifecycleStatus}`,
    domain: "installed_systems" as const,
    sourceLabel: "Installed Systems",
    href: ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id),
    metadata: {
      badges: [system.manufacturer, system.modelNumber],
      status: system.lifecycleStatus,
      timestamp: system.installDate,
    },
    recordType: "entity" as const,
    tokens: sanitizeTokenStrings([
      system.systemName,
      system.customerName,
      system.propertyName,
      system.manufacturer,
      system.modelNumber,
      system.location,
      ...(system.serialNumbers ?? []),
    ]),
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
    domain: "documents" as const,
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.DOCUMENTS(document.projectId),
    recordType: "document" as const,
    tokens: sanitizeTokenStrings([document.title, document.category, document.visibility, document.projectId]),
    contextRefs: { projectId: document.projectId },
  }));

  const portalPhotoRecords: SearchRecord[] = fakePhotosProjectionRecords.map((photo) => ({
    id: `portal-photo-${photo.photoId}`,
    title: photo.caption,
    subtitle: `Portal project ${photo.projectId}`,
    domain: "photos" as const,
    sourceLabel: "Project Portal",
    href: PORTAL_ROUTES.PHOTOS(photo.projectId),
    recordType: "photo" as const,
    tokens: sanitizeTokenStrings([photo.caption, photo.projectId]),
    contextRefs: { projectId: photo.projectId },
  }));

  const navigationRecords: SearchRecord[] = NAVIGATION_TARGETS.map((target) => ({
    id: `navigation-${target.href}`,
    title: target.label,
    subtitle: `Navigate to ${target.label}`,
    domain: "navigation" as const,
    sourceLabel: "Navigation",
    href: target.href,
    recordType: "navigation" as const,
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
  const [
    { jobs },
    properties,
    customers,
    installedSystemsRaw,
    knowledgeItems,
    portalProjects,
    portalDocuments,
    portalPhotos,
    performanceModels,
    propertyArtifacts,
  ] = await Promise.all([
    listJobsWithActivity(),
    listProperties(),
    listCustomers(),
    listInstalledSystems().catch(() => []),
    listKnowledgeItems().catch(() => []),
    listPortalProjects().catch(() => []),
    listAllPortalDocuments().catch(() => []),
    listAllPortalPhotos().catch(() => []),
    listPerformanceModels({ status: "active" }).catch(() => []),
    getAllPropertyArtifacts().catch(() => ({ documents: [], photos: [] })),
  ]);

  const installedSystems = Array.isArray(installedSystemsRaw)
    ? installedSystemsRaw
    : installedSystemsRaw.ok
      ? installedSystemsRaw.data
      : [];

  const navigationRecords: SearchRecord[] = NAVIGATION_TARGETS.map((target) => ({
    id: `navigation-${target.href}`,
    title: target.label,
    subtitle: `Navigate to ${target.label}`,
    domain: "navigation" as const,
    sourceLabel: "Navigation",
    href: target.href,
    recordType: "navigation" as const,
    tokens: sanitizeTokenStrings([target.label, ...target.aliases]),
  }));

  const manualRecords: SearchRecord[] = equipmentCatalog.flatMap((entry) => [
    {
      id: `manual-${entry.id}`,
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
      id: `submittal-${entry.id}`,
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
  ]);

  return [
    ...jobs.map((job) => ({
      id: `job-${job.id}`,
      title: `${job.jobNumber} · ${job.title}`,
      subtitle: `${job.propertyName} • ${job.customerName}`,
      domain: "jobs" as const,
      sourceLabel: "Jobs",
      href: ROUTE_BUILDERS.JOB_DETAIL(job.id),
      metadata: {
        badges: [job.type, job.priority],
        status: job.status,
        timestamp: job.scheduledFor ?? undefined,
      },
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
      metadata: {
        badges: [property.type, property.primarySystem],
        status: property.status,
        timestamp: property.lastVisit,
      },
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
      metadata: {
        badges: [`${customer.propertyCount} properties`, `${customer.openJobs} open jobs`],
        status: customer.status,
        timestamp: customer.lastActivity,
      },
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([customer.name, customer.primaryContact, customer.city, customer.email, customer.phone]),
      contextRefs: { customerId: customer.id },
    })),
    ...installedSystems.map((system) => ({
      id: `system-${system.id}`,
      title: system.systemName,
      subtitle: `${system.propertyName} • ${system.lifecycleStatus}`,
      domain: "installed_systems" as const,
      sourceLabel: "Installed Systems",
      href: ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id),
      metadata: {
        badges: [system.manufacturer, system.modelNumber],
        status: system.lifecycleStatus,
        timestamp: system.installDate,
      },
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([
        system.systemName,
        system.customerName,
        system.propertyName,
        system.manufacturer,
        system.modelNumber,
        system.location,
        ...(system.serialNumbers ?? []),
      ]),
      contextRefs: {
        installedSystemId: system.id,
        propertyId: system.propertyId ?? undefined,
        jobId: system.jobId ?? undefined,
      },
    })),
    ...knowledgeItems.map((item) => ({
      id: `knowledge-${item.id}`,
      title: item.title,
      subtitle: item.summary,
      domain: "company_brain" as const,
      sourceLabel: "Company Brain",
      href: ROUTE_BUILDERS.COMPANY_BRAIN_EDIT(item.id),
      metadata: {
        badges: [item.knowledgeType, ...item.tags.slice(0, 2)],
        status: item.status,
        timestamp: item.updatedAt,
      },
      recordType: "document" as const,
      tokens: sanitizeTokenStrings([item.title, item.summary, item.body, ...item.tags, ...item.relatedDomains]),
    })),
    ...portalProjects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: `${project.status.replaceAll("_", " ")} • ${project.projectManager}`,
      domain: "projects" as const,
      sourceLabel: "Project Portal",
      href: PORTAL_ROUTES.PROJECT(project.id),
      recordType: "entity" as const,
      tokens: sanitizeTokenStrings([project.name, project.address, project.projectManager, project.nextMilestone]),
      contextRefs: { projectId: project.id },
    })),
    ...portalDocuments.map((doc) => ({
      id: `portal-document-${doc.id}`,
      title: doc.name,
      subtitle: `${doc.documentType} • Portal project ${doc.projectId}`,
      domain: "documents" as const,
      sourceLabel: "Project Portal",
      href: PORTAL_ROUTES.DOCUMENTS(doc.projectId),
      recordType: "document" as const,
      tokens: sanitizeTokenStrings([doc.name, doc.documentType, doc.visibility, doc.projectId]),
      contextRefs: { projectId: doc.projectId },
    })),
    ...portalPhotos.map((photo) => ({
      id: `portal-photo-${photo.id}`,
      title: photo.caption ?? photo.category,
      subtitle: `Portal project ${photo.projectId}`,
      domain: "photos" as const,
      sourceLabel: "Project Portal",
      href: PORTAL_ROUTES.PHOTOS(photo.projectId),
      recordType: "photo" as const,
      tokens: sanitizeTokenStrings([photo.caption ?? "", photo.category, photo.projectId]),
      contextRefs: { projectId: photo.projectId },
    })),
    ...performanceModels.map((model) => ({
      id: `report-${model.id}`,
      title: model.title,
      subtitle: model.description,
      domain: "reports" as const,
      sourceLabel: "Reporting",
      href: ROUTES.REPORTING,
      recordType: "report" as const,
      tokens: sanitizeTokenStrings([model.title, model.description, ...model.relatedDomains]),
    })),
    ...propertyArtifacts.documents.map((document) => ({
      id: `property-document-${document.id}`,
      title: document.title,
      subtitle: `${document.category} • Property ${document.propertyId}`,
      domain: "documents" as const,
      sourceLabel: "Properties",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(document.propertyId),
      recordType: "document" as const,
      tokens: sanitizeTokenStrings([
        document.title,
        document.category,
        document.status,
        document.propertyId,
      ]),
      contextRefs: { propertyId: document.propertyId },
    })),
    ...propertyArtifacts.photos.map((photo) => ({
      id: `property-photo-${photo.id}`,
      title: photo.title,
      subtitle: `${photo.category} • Property ${photo.propertyId}`,
      domain: "photos" as const,
      sourceLabel: "Properties",
      href: ROUTE_BUILDERS.PROPERTY_DETAIL(photo.propertyId),
      recordType: "photo" as const,
      tokens: sanitizeTokenStrings([photo.title, photo.category, photo.status, photo.propertyId]),
      contextRefs: { propertyId: photo.propertyId },
    })),
    ...manualRecords,
    ...navigationRecords,
  ];
}