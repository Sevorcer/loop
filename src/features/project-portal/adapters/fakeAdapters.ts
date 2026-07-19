import {
  fakeChangeOrdersProjectionRecords,
  fakeDailyPlansProjectionRecords,
  fakeDispatchProjectionRecords,
  fakeDocumentsProjectionRecords,
  fakeInstalledSystemsProjectionRecords,
  fakeJobsProjectionRecords,
  fakePhotosProjectionRecords,
  fakePortalEvents,
  fakeReportingProjectionRecords,
} from "../data/fakePortalArtifacts";
import type {
  ChangeOrdersAdapter,
  DailyPlansAdapter,
  DispatchAdapter,
  DocumentsAdapter,
  InstalledSystemsAdapter,
  JobsAdapter,
  PhotosAdapter,
  PortalReadOnlyAdapter,
  PortalUpstreamAdapters,
  ReportingAdapter,
} from "./types";

function buildAdapter<TRecord>(
  adapter: PortalReadOnlyAdapter<TRecord>
): PortalReadOnlyAdapter<TRecord> {
  return adapter;
}

const fakeJobsAdapter = buildAdapter<
  Awaited<ReturnType<JobsAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeJobsAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "jobs",
  },
  async fetchProjectRecords(projectId) {
    return fakeJobsProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakePortalEvents.filter(
      (event) => event.source_domain === "jobs" && (!projectId || event.aggregate_id === projectId)
    );
  },
}) as JobsAdapter;

const fakeDailyPlansAdapter = buildAdapter<
  Awaited<ReturnType<DailyPlansAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeDailyPlansAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "daily-plans",
  },
  async fetchProjectRecords(projectId) {
    return fakeDailyPlansProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents() {
    return [];
  },
}) as DailyPlansAdapter;

const fakeDispatchAdapter = buildAdapter<
  Awaited<ReturnType<DispatchAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeDispatchAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "dispatch",
  },
  async fetchProjectRecords(projectId) {
    return fakeDispatchProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakePortalEvents.filter(
      (event) =>
        event.source_domain === "dispatch" && (!projectId || event.aggregate_id === projectId)
    );
  },
}) as DispatchAdapter;

const fakeInstalledSystemsAdapter = buildAdapter<
  Awaited<ReturnType<InstalledSystemsAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeInstalledSystemsAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "installed-systems",
  },
  async fetchProjectRecords(projectId) {
    return fakeInstalledSystemsProjectionRecords.filter(
      (record) => record.projectId === projectId
    );
  },
  async fetchEvents() {
    return [];
  },
}) as InstalledSystemsAdapter;

const fakeDocumentsAdapter = buildAdapter<
  Awaited<ReturnType<DocumentsAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeDocumentsAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "documents",
  },
  async fetchProjectRecords(projectId) {
    return fakeDocumentsProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents(projectId) {
    return fakePortalEvents.filter(
      (event) =>
        event.source_domain === "documents" && (!projectId || event.aggregate_id === projectId)
    );
  },
}) as DocumentsAdapter;

const fakePhotosAdapter = buildAdapter<
  Awaited<ReturnType<PhotosAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakePhotosAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "photos",
  },
  async fetchProjectRecords(projectId) {
    return fakePhotosProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents() {
    return [];
  },
}) as PhotosAdapter;

const fakeChangeOrdersAdapter = buildAdapter<
  Awaited<ReturnType<ChangeOrdersAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeChangeOrdersAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "change-orders",
  },
  async fetchProjectRecords(projectId) {
    return fakeChangeOrdersProjectionRecords.filter(
      (record) => record.projectId === projectId
    );
  },
  async fetchEvents(projectId) {
    return fakePortalEvents.filter(
      (event) =>
        event.source_domain === "change-orders" &&
        (!projectId || event.aggregate_id === projectId)
    );
  },
}) as ChangeOrdersAdapter;

const fakeReportingAdapter = buildAdapter<
  Awaited<ReturnType<ReportingAdapter["fetchProjectRecords"]>>[number]
>({
  metadata: {
    adapterName: "fakeReportingAdapter",
    adapterMode: "fake",
    readOnly: true,
    sourceDomain: "reporting",
  },
  async fetchProjectRecords(projectId) {
    return fakeReportingProjectionRecords.filter((record) => record.projectId === projectId);
  },
  async fetchEvents() {
    return [];
  },
}) as ReportingAdapter;

export function createFakePortalAdapters(): PortalUpstreamAdapters {
  return {
    jobs: fakeJobsAdapter,
    dailyPlans: fakeDailyPlansAdapter,
    dispatch: fakeDispatchAdapter,
    installedSystems: fakeInstalledSystemsAdapter,
    documents: fakeDocumentsAdapter,
    photos: fakePhotosAdapter,
    changeOrders: fakeChangeOrdersAdapter,
    reporting: fakeReportingAdapter,
  };
}
