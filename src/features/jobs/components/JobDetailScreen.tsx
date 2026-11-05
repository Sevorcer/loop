"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  Camera,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  HardHat,
  History,
  LayoutGrid,
  MapPin,
  Navigation,
  RotateCcw,
  Shield,
  Trash2,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { useContractors } from "@/features/contractors/state/ContractorsProvider";
import { JobInstalledSystemsPanel } from "@/features/installed-systems/components/JobInstalledSystemsPanel";
import { useInstalledSystems } from "@/features/installed-systems/state/InstalledSystemsProvider";
import {
  JobMaterialsPanel,
  JobMaterialsProvider,
  JobTechnicalDataPanel,
  JobTechnicalDataProvider,
} from "@/features/job-materials";
import { canViewJobMaterials } from "@/features/job-materials/utils/jobMaterials";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { joinAddressParts } from "@/lib/address";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { formatTeamLabel } from "@/lib/teamLabel";
import { cn } from "@/lib/utils";

import type { JobCallbackContext } from "../types/jobCallback";
import { EMPTY_JOB_CALLBACK_CONTEXT } from "../types/jobCallback";
import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type { JobNote } from "../types/jobNote";
import type { JobSignature } from "../types/jobSignature";
import {
  parseLatestQaChecklist,
  REQUIRED_QA_CHECKLIST_ITEMS,
  type RequiredQaChecklist,
} from "../utils/jobCompletionChecklist";
import { FollowUpControl } from "@/features/follow-ups/components/FollowUpControl";
import { finalScheduledDayBlocker } from "../utils/jobFinalDay";
import { requiresStartupAndInstalledSystemGates } from "../utils/jobInstallStage";
import { formatSignatureCaption } from "../utils/jobSignature";
import { activityWithJobNotes, displayJobNotes } from "../utils/jobNotes";
import { getJobStatusIntent, sortJobActivity } from "../utils/jobWorkspace";
import {
  JOB_CLOSEOUT_SECTION_IDS,
  jobCloseoutModeLabel,
  scrollToJobSection,
  type CloseoutSectionKey,
} from "../utils/jobCloseout";
import { AssignContractorPanel } from "./AssignContractorPanel";
import { JobNotificationsCard } from "./JobNotificationsCard";
import { JobCloseoutPanel } from "./JobCloseoutPanel";
import { JobNotesHistory } from "./JobNotesHistory";
import { JobCompletionChecklistCard } from "./JobCompletionChecklistCard";
import { JobFilesPanel } from "./JobFilesPanel";
import { CreateCallbackPanel } from "./CreateCallbackPanel";
import { JobSignatureCard } from "./JobSignatureCard";
import { JobMobileActionBar } from "./JobMobileActionBar";
import { JobNoteComposer } from "./JobNoteComposer";
import { JobStatusActions } from "./JobStatusActions";
import { JobTasksCard } from "./JobTasksCard";
import { JobDayByDay } from "./JobDayByDay";
import { JobBidPanel } from "./JobBidPanel";
import { JobInspectionsCard } from "./JobInspectionsCard";
import { JobPermitsCard } from "./JobPermitsCard";
import { JobChangeOrdersCard } from "./JobChangeOrdersCard";
import { JobPriceEditor } from "./JobPriceEditor";
import { JobMoneySection } from "./JobMoneySection";
import { JobTimeline } from "./JobTimeline";
import { ShareLinkControls } from "./ShareLinkControls";
import { PortalMoneyToggle } from "./PortalMoneyToggle";
import { PortalPhotosToggle } from "./PortalPhotosToggle";
import { PortalSubmissions } from "./PortalSubmissions";
import { canSeeJobRevenue, canViewJobPrice } from "@/features/reporting/utils/revenueAccess";
import { formatCompanyScheduleRange, formatJobAppointmentDisplay, formatJobHeaderSchedule } from "../utils/schedulingTime";
import { formatDateOnly } from "@/lib/dates";
import { companyTimeZone } from "@/lib/timezone";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unscheduled";
  return formatDateOnly(value);
}

function getStatusVariant(status: JobStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}


/**
 * The job page is organised into five tabs so nobody scroll-hunts through
 * one long stack of panels. One shared active-tab state drives two navs:
 * a sticky top tab bar on desktop and a pinned bottom tab bar on phones.
 * Every panel stays mounted (hidden when inactive) so in-progress work —
 * a file upload, a half-written checklist — survives tab switches, and
 * the panels can keep reporting the counts shown on the tab badges.
 */
type JobDetailTab = "overview" | "tasks" | "photos" | "systems" | "activity";

/** Sub-tabs within the Overview tab for specialized sections below the fold. */
type OverviewSubTab = "permits" | "portal" | "financials" | "bid";

interface OverviewSubTabDef {
  key: OverviewSubTab;
  label: string;
  icon: LucideIcon;
  /** When provided, only show this sub-tab for these roles. */
  roles?: string[];
}

const OVERVIEW_SUB_TABS: OverviewSubTabDef[] = [
  { key: "permits", label: "Permits & Inspections", icon: Shield },
  { key: "portal", label: "GC Portal", icon: Globe, roles: ["owner", "manager", "office"] },
  { key: "financials", label: "Financials", icon: DollarSign },
  { key: "bid", label: "Bid", icon: FileText },
];

interface JobDetailTabDef {
  key: JobDetailTab;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
}

const JOB_DETAIL_TABS: JobDetailTabDef[] = [
  { key: "overview", label: "Overview", mobileLabel: "Overview", icon: LayoutGrid },
  { key: "tasks", label: "Tasks & QA", mobileLabel: "Tasks", icon: ClipboardList },
  { key: "photos", label: "Photos & Files", mobileLabel: "Photos", icon: Camera },
  { key: "systems", label: "Systems", mobileLabel: "Systems", icon: Wrench },
  { key: "activity", label: "Notes", mobileLabel: "Notes", icon: History },
];

function jobDetailPanelId(tab: JobDetailTab) {
  return `job-detail-panel-${tab}`;
}

/** Which tab owns each closeout section, and the section wrapper inside it. */
const CLOSEOUT_SECTION_TARGETS: Record<
  CloseoutSectionKey,
  { tab: JobDetailTab; sectionId: string }
> = {
  files: { tab: "photos", sectionId: JOB_CLOSEOUT_SECTION_IDS.photos },
  tasks: { tab: "tasks", sectionId: JOB_CLOSEOUT_SECTION_IDS.qa },
  systems: { tab: "systems", sectionId: JOB_CLOSEOUT_SECTION_IDS.systems },
};

function JobDetailTabPanel({
  tab,
  activeTab,
  children,
}: {
  tab: JobDetailTab;
  activeTab: JobDetailTab;
  children: ReactNode;
}) {
  const isActive = activeTab === tab;
  return (
    <section
      role="tabpanel"
      id={jobDetailPanelId(tab)}
      aria-labelledby={`job-detail-tab-desktop-${tab} job-detail-tab-mobile-${tab}`}
      aria-hidden={!isActive}
      className={cn(!isActive && "hidden")}
    >
      {children}
    </section>
  );
}

interface JobDetailScreenProps {
  job: Job;
  activity: JobActivity[];
  notes: JobNote[];
  callbackContext?: JobCallbackContext;
  onUpdateStatus: (status: JobStatus) => Promise<void>;
  onPriceRecorded?: (activity: JobActivity) => void;
  onAddNote: (note: string) => Promise<void>;
  onUpdateQaChecklist: (checklist: RequiredQaChecklist) => Promise<void>;
  onSoftDelete?: () => Promise<void>;
  onRestore?: () => Promise<void>;
    deleteRestorePending?: boolean;
  priceVisible?: boolean;
  priceCents?: number | null;
}

export function JobDetailScreen({
  job,
  activity,
  notes,
  callbackContext = EMPTY_JOB_CALLBACK_CONTEXT,
  onUpdateStatus,
  onPriceRecorded,
  onAddNote,
  onUpdateQaChecklist,
  onSoftDelete,
  onRestore,
    deleteRestorePending = false,
  priceVisible = false,
  priceCents = null,
}: JobDetailScreenProps) {
  const { role } = useCurrentRole();
  const isTech = role === "tech";
  const canEditInspectionsForRole = role === "owner" || role === "manager" || role === "office";
  const canEditPermitsForRole = role === "owner" || role === "manager" || role === "office";
  const canEditChangeOrders = role === "owner" || role === "manager" || role === "office";
  const canDeleteChangeOrders = role === "owner" || role === "manager";
  const { getInstalledSystemsForJob } = useInstalledSystems();
  const { contractors } = useContractors();
  const [fileCount, setFileCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [latestSignature, setLatestSignature] = useState<JobSignature | null>(null);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("overview");
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubTab>("permits");
  const [taskCounts, setTaskCounts] = useState<{ done: number; total: number } | null>(null);
  const [systemsCount, setSystemsCount] = useState<number | null>(null);

  const handleTaskCounts = useCallback((counts: { done: number; total: number }) => {
    setTaskCounts((current) =>
      current && current.done === counts.done && current.total === counts.total
        ? current
        : counts,
    );
  }, []);

  const handleFilesChanged = useCallback(
    (files: { mimeType: string; uploaderRole: string | null }[]) => {
      setFileCount(files.length);
      setPhotoCount(
        files.filter(
          (file) =>
            file.mimeType.toLowerCase().startsWith("image/") && file.uploaderRole === "tech",
        ).length,
      );
    },
    [],
  );

  const handleSystemsCount = useCallback((count: number) => {
    setSystemsCount(count);
  }, []);

  /**
   * Closeout step jump: switch to the tab that owns the section, then —
   * once that panel is visible — scroll to the section and flash it,
   * reusing the same highlight the single-page layout used.
   */
  const handleShowSection = useCallback((section: CloseoutSectionKey) => {
    const target = CLOSEOUT_SECTION_TARGETS[section];
    setActiveTab(target.tab);
    const scroll = () => scrollToJobSection(target.sectionId);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(scroll);
      });
    } else {
      scroll();
    }
  }, []);

  const qaChecklist = useMemo(() => parseLatestQaChecklist(activity), [activity]);

  // QA item counts from the checklist — the badge should reflect both
  // tasks and QA items since the tab is "Tasks & QA".
  const qaTotal = REQUIRED_QA_CHECKLIST_ITEMS.length;
  const qaDone = [
    qaChecklist.startupVerificationComplete,
    qaChecklist.safetyReviewComplete,
    qaChecklist.workAreaCleaned,
  ].filter(Boolean).length;

  const desktopBadge = (tab: JobDetailTab): string | null => {
    switch (tab) {
      case "tasks": {
        const tasksDone = taskCounts?.done ?? 0;
        const tasksTotal = taskCounts?.total ?? 0;
        const totalDone = tasksDone + qaDone;
        const totalItems = tasksTotal + qaTotal;
        return totalItems > 0 ? `${totalDone}/${totalItems}` : null;
      }
      case "photos":
        return fileCount ? String(fileCount) : null;
      case "systems":
        return systemsCount ? String(systemsCount) : null;
      default:
        return null;
    }
  };
  const tasksRemaining =
    (taskCounts ? taskCounts.total - taskCounts.done : 0) + (qaTotal - qaDone);

  const noteHistory = useMemo(
    () => displayJobNotes(notes, job.notes, activity),
    [notes, job.notes, activity],
  );
  const orderedActivity = useMemo(
    () => sortJobActivity(activityWithJobNotes(activity, noteHistory)),
    [activity, noteHistory],
  );
  const visibleSubTabs = useMemo(
    () => OVERVIEW_SUB_TABS.filter((t) => !t.roles || (role && t.roles.includes(role))),
    [role],
  );

  // F20: prefer the real scheduled time over the legacy appointment-hour
  // field, which always falls back to 9 AM for jobs created by the new form.
  const appointmentDisplay = formatJobAppointmentDisplay(job);
  const locationLabel = joinAddressParts([job.location]);
  const currentTeam = job.assignees && job.assignees.length > 0
    ? formatTeamLabel(job.assignees.map((assignee) => assignee.name))
    : job.assignedTo || "";
  const assignedTechNames = currentTeam || "No technician assigned";
  const completedTeam = job.status === "Completed" && job.completionTeam && job.completionTeam.length > 0
    ? formatTeamLabel(job.completionTeam.map((person) => person.name))
    : "";
  const scheduleRangeLabel =
    formatJobHeaderSchedule(job.scheduledStartAt, job.scheduledEndAt) ??
    formatCompanyScheduleRange(job.scheduledStartAt ?? job.scheduledFor, job.scheduledEndAt);
  // F15: "Assigned To" (internal technician) and "Assigned Contractors"
  // (external subs) are stored separately and could silently disagree on this
  // screen. Render them side by side so both facts are always visible together.
  const assignedContractorNames = useMemo(
    () =>
      (job.contractorIds ?? [])
        .map((id) => contractors.find((c) => c.id === id)?.companyName)
        .filter((name): name is string => Boolean(name)),
    [job.contractorIds, contractors],
  );
  const statusVariant = getStatusVariant(job.status);

  const statusIntent = getJobStatusIntent(job.status);
  const installedSystemsEntered =
    getInstalledSystemsForJob(job.id, job.propertyId ?? undefined).length > 0;
  const jobNotesCompleted =
    notes.some((note) => note.body.trim().length > 0) || job.notes.trim().length > 0;

  return (
    // The mobile bottom tab bar is about 4rem tall, plus the home-indicator
    // inset. Pad past both so the last block can scroll clear of it.
    <div className="space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <div className="flex items-center justify-between gap-4">
        {/*
         * Stopgap: plain <a>, not router.push, same reason as Edit Job (#324).
         * Soft navigation OUT of /jobs/[id] never commits — the router starts
         * the transition but it never lands — so router.push("/jobs") here was
         * a silent no-op and users got stuck on the job page. A plain anchor is
         * not intercepted by the App Router and does a real browser navigation.
         * The proper fix (loading.tsx/error.tsx Suspense boundary on jobs/[id],
         * PR #325) should let soft nav commit again and retire this workaround.
         */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard-navigation required: PRs #324/#326 fix soft-nav bug */}
        <a href="/jobs" data-testid="back-to-jobs-link">
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>
        </a>

        {isTech ? null : (
          <PermissionGuard table="jobs" action="update">
            {/*
             * Edit uses a PLAIN <a>, NOT next/link or router.push, on purpose.
             *
             * Instrumented diagnosis (probe v1–v3 on preview) proved the client
             * router issues a correct RSC navigation for this route
             * (GET /jobs/<id>/edit?_rsc, headers RSC:1 + Next-Router-State-Tree)
             * and receives a valid 200 text/x-component flight payload — yet it
             * silently fails to COMMIT the /jobs/[id] -> /jobs/[id]/edit
             * transition: URL never changes, nothing renders, no error. Both
             * router.push and <Link> drive that same broken soft-nav path, so
             * both are no-ops here. A full-document load of the same URL renders
             * correctly (verified directly), so we force one: a plain anchor is
             * not intercepted by the App Router and performs a real browser
             * navigation to the proven-good path. (Deliberate deviation from the
             * "always use Link" guideline for this one framework-level soft-nav
             * failure; see the diag notes. type="button" keeps the inner native
             * button from acting on its own so the anchor handles the click.)
             */}
            <a href={ROUTE_BUILDERS.JOB_EDIT(job.id)} data-testid="edit-job-link">
              <Button type="button" variant="secondary" className="min-h-[44px]">
                Edit Job
              </Button>
            </a>
          </PermissionGuard>
        )}

        {onSoftDelete && !isTech ? (
          <PermissionGuard table="jobs" action="update">
            <Button
              type="button"
              variant="ghost"
              disabled={deleteRestorePending}
              className="min-h-[44px] gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              data-testid="soft-delete-job-btn"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this job? It can be restored later by an owner.")) {
                  void onSoftDelete();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </PermissionGuard>
        ) : null}

        {onRestore && role === "owner" ? (
          <Button
            type="button"
            variant="ghost"
            disabled={deleteRestorePending}
            className="min-h-[44px] gap-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            data-testid="restore-job-btn"
            onClick={() => {
              void onRestore();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Restore
          </Button>
        ) : null}
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-slate-400 sm:text-sm">
                  {job.jobNumber}
                </p>
                <StatusBadge variant={statusVariant}>
                  {job.status}
                </StatusBadge>
              </div>

              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {job.title}
              </h1>

              {/* Inline meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400 sm:text-xs [&>span]:basis-[calc(50%-0.5rem)] sm:[&>span]:basis-auto">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {scheduleRangeLabel ?? (job.scheduledFor ? formatDate(job.scheduledFor) : job.scheduledStartAt ? formatDate(job.scheduledStartAt) : "Unscheduled")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {currentTeam || "Unassigned"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3" />
                  {jobCloseoutModeLabel(job.closeoutMode)}
                </span>
                {job.propertyName ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.propertyName}
                  </span>
                ) : null}
              </div>

              {callbackContext.original ? (
                <Link
                  href={ROUTE_BUILDERS.JOB_DETAIL(callbackContext.original.id)}
                  className="inline-flex min-h-[44px] items-center text-xs text-amber-200 hover:underline sm:text-sm"
                >
                  Callback for {callbackContext.original.jobNumber}
                </Link>
              ) : null}
              {callbackContext.returnVisits.map((visit) => (
                <Link
                  key={visit.id}
                  href={ROUTE_BUILDERS.JOB_DETAIL(visit.id)}
                  className="inline-flex min-h-[44px] items-center text-xs text-amber-200 hover:underline sm:text-sm"
                >
                  Return visit {visit.jobNumber}
                </Link>
              ))}
              {callbackContext.reason ? (
                <p className="text-xs text-slate-300 sm:text-sm">Callback reason: {callbackContext.reason}</p>
              ) : null}
            </div>

            <div className="hidden shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10 sm:flex sm:h-14 sm:w-14">
              <Briefcase className="h-6 w-6 text-red-300" />
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Desktop tab bar: sticky under the shell header, which is ~7.5rem
          tall at sm+ widths. Hidden on phones — the bottom bar below is
          the mobile nav for the same tab state. */}
      <div
        role="tablist"
        aria-label="Job sections"
        className="sticky top-[7.5rem] z-20 -mx-4 hidden border-b border-white/10 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 md:block lg:-mx-8 lg:px-8"
      >
        <div className="flex gap-2 overflow-x-auto">
          {JOB_DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = desktopBadge(tab.key);
            return (
              <Button
                key={tab.key}
                type="button"
                role="tab"
                id={`job-detail-tab-desktop-${tab.key}`}
                aria-selected={isActive}
                aria-controls={jobDetailPanelId(tab.key)}
                variant={isActive ? "primary" : "ghost"}
                onClick={() => setActiveTab(tab.key)}
                className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4"
              >
                {tab.label}
                {badge ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                      isActive ? "bg-white/25 text-white" : "bg-white/10 text-slate-300",
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      </div>

      <JobDetailTabPanel tab="overview" activeTab={activeTab}>
        {/* Two-column grid: main (wider) + sidebar (340px sticky) */}
        <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-start">

          {/* ── Main column ── */}
          <div className="min-w-0 flex-1 space-y-4 sm:space-y-6">
            <PermissionGuard table="jobs" action="update">
              <JobStatusActions
                status={job.status}
                onChangeStatus={onUpdateStatus}
              />
            </PermissionGuard>

            {/* 1. Closeout Progress */}
            <PermissionGuard table="jobs" action="update">
              <JobCloseoutPanel
                jobId={job.id}
                status={job.status}
                onAddNote={onAddNote}
                onUpdateStatus={onUpdateStatus}
                onShowSection={handleShowSection}
              />
            </PermissionGuard>

            {/* 2. Work Summary */}
            <SurfaceCard className="min-w-0">
              <div className="p-4 sm:p-6">
                <h2 className="text-base font-semibold text-white sm:text-lg">Work Summary</h2>
                <p className="mt-2 text-xs leading-6 text-slate-400 sm:mt-3 sm:text-sm sm:leading-7">
                  {job.summary}
                </p>
              </div>
            </SurfaceCard>

            {/* 3. Quick note — composer only. The notes HISTORY (timeline)
                stays under the Notes tab, never in Overview (pinned by
                    jobDetailScreenTabs.test.ts). */}
            <SurfaceCard className="min-w-0">
              <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
                <h2 className="text-base font-semibold text-white sm:text-lg">Add Note</h2>

                <PermissionGuard table="job_notes" action="insert">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <JobNoteComposer onAddNote={onAddNote} />
                  </div>
                </PermissionGuard>
              </div>
            </SurfaceCard>

            {/* 4. Sub-tabs for specialized sections below the fold */}
            <div className="overflow-hidden rounded-3xl border border-default bg-surface shadow-atlas-md">
              {/* Sub-tab bar — scrolls horizontally on mobile */}
              <div className="flex gap-0 overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleSubTabs.map((tab) => {
                  const isActive = overviewSubTab === tab.key;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setOverviewSubTab(tab.key)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:py-3 sm:text-sm",
                        isActive
                          ? "border-sky-400 text-sky-300"
                          : "border-transparent text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <TabIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-tab panels */}
              <div className="p-3 sm:p-5">
                {/* Permits & Inspections — side by side on desktop, stacked on mobile */}
                {overviewSubTab === "permits" && (
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                    <PermissionGuard table="job_permits" action="select">
                      <JobPermitsCard jobId={job.id} canEdit={canEditPermitsForRole} />
                    </PermissionGuard>
                    <PermissionGuard table="job_inspections" action="select">
                      <JobInspectionsCard jobId={job.id} canEdit={canEditInspectionsForRole} />
                    </PermissionGuard>
                  </div>
                )}

                {/* GC Portal */}
                {overviewSubTab === "portal" && (role === "owner" || role === "manager" || role === "office") && (
                  <div className="space-y-5">
                    <ShareLinkControls jobId={job.id} />

                    <div className="border-t border-white/10" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <PortalMoneyToggle jobId={job.id} />
                      <PortalPhotosToggle jobId={job.id} />
                    </div>

                    <div className="border-t border-white/10" />

                    <PortalSubmissions jobId={job.id} />
                  </div>
                )}

                {/* Financials — price editor + change orders */}
                {overviewSubTab === "financials" && (
                  <div className="grid gap-4 sm:gap-6">
                    {priceVisible && canViewJobPrice(role) ? (
                      <JobPriceEditor
                        key={`${job.id}:${priceCents ?? "none"}:${role ?? ""}`}
                        jobId={job.id}
                        status={job.status}
                        initialCents={priceCents}
                        readOnly={!canSeeJobRevenue(role)}
                        onRecorded={onPriceRecorded}
                      />
                    ) : null}
                    {role && role !== "tech" && role !== "portal" ? (
                      <JobMoneySection jobId={job.id} />
                    ) : null}
                    <PermissionGuard table="job_change_orders" action="select">
                      <JobChangeOrdersCard
                        jobId={job.id}
                        canEdit={canEditChangeOrders}
                        canDelete={canDeleteChangeOrders}
                        priceCents={priceCents}
                      />
                    </PermissionGuard>
                  </div>
                )}

                {/* Bid */}
                {overviewSubTab === "bid" && (
                  <PermissionGuard table="job_bids" action="select">
                    <JobBidPanel jobId={job.id} />
                  </PermissionGuard>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar (340px, sticky on desktop) ── */}
          <div className="w-full space-y-4 sm:space-y-6 lg:sticky lg:top-[110px] lg:w-[340px] lg:shrink-0">

            {/* Job Info card */}
            <SurfaceCard>
              <div className="p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-white sm:text-base">Job Info</h2>

                <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                  {/* Customer */}
                  <div className="flex items-start gap-3">
                    <Briefcase className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Customer
                      </p>
                      {job.customerId && !isTech ? (
                        <Link
                          href={ROUTE_BUILDERS.CUSTOMER_DETAIL(job.customerId)}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 hover:underline sm:text-sm"
                        >
                          {job.customerName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                          {job.customerName || "No customer linked"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  {locationLabel ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                          Location
                        </p>
                        <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">{locationLabel}</p>
                        <div className="mt-1.5 flex gap-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLabel)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-white/[0.08] sm:px-3 sm:py-1.5 sm:text-xs"
                          >
                            <Navigation className="h-3 w-3" />
                            Maps
                          </a>
                          <a
                            href={`https://maps.apple.com/?q=${encodeURIComponent(locationLabel)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-white/[0.08] sm:px-3 sm:py-1.5 sm:text-xs"
                          >
                            <Navigation className="h-3 w-3" />
                            Apple
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Property */}
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Property
                      </p>
                      {job.propertyId ? (
                        <Link
                          href={ROUTE_BUILDERS.PROPERTY_DETAIL(job.propertyId)}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 hover:underline sm:text-sm"
                        >
                          {job.propertyName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                          {job.propertyName || "No property linked"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Scheduled
                      </p>
                      <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                        {scheduleRangeLabel ?? (job.scheduledFor ? formatDate(job.scheduledFor) : job.scheduledStartAt ? formatDate(job.scheduledStartAt) : "Unscheduled")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">{appointmentDisplay}</p>
                    </div>
                  </div>

                  {/* Type & Closeout */}
                  <div className="flex items-start gap-3" data-job-detail-field="closeout-mode">
                    <ClipboardCheck className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Type / Closeout
                      </p>
                      <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                        {job.type} &middot; {jobCloseoutModeLabel(job.closeoutMode)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <FollowUpControl jobId={job.id} />

            {/* Crew card */}
            <SurfaceCard>
              <div className="p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-white sm:text-base">Crew</h2>

                <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Team
                      </p>
                      <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                        {assignedTechNames}
                      </p>
                      {completedTeam && completedTeam !== currentTeam ? (
                        <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">
                          Completed by: {completedTeam}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <HardHat className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Contractors
                      </p>
                      <p className="mt-0.5 text-xs text-slate-200 sm:text-sm">
                        {assignedContractorNames.length > 0
                          ? assignedContractorNames.join(", ")
                          : "None assigned"}
                      </p>
                    </div>
                  </div>

                  {isTech ? null : <AssignContractorPanel jobId={job.id} />}
                </div>
              </div>
            </SurfaceCard>

            {/* Callback card */}
            <CreateCallbackPanel
              jobId={job.id}
              status={job.status}
              callbackContext={callbackContext}
            />

            {/* Customer notifications card */}
            <JobNotificationsCard jobId={job.id} />

            {/* Signature card */}
            <JobSignatureCard jobId={job.id} onLatestChange={setLatestSignature} />
          </div>
        </div>
      </JobDetailTabPanel>

      <JobDetailTabPanel tab="tasks" activeTab={activeTab}>
        <div className="space-y-6">
          <JobTasksCard
            jobId={job.id}
            jobType={job.type}
            onCountsChange={handleTaskCounts}
          />

          {canViewJobMaterials(role) ? (
            <JobMaterialsProvider jobId={job.id}>
              <JobMaterialsPanel />
            </JobMaterialsProvider>
          ) : null}

          <div
            id={JOB_CLOSEOUT_SECTION_IDS.qa}
            className="scroll-mt-24 rounded-3xl transition-shadow duration-500 md:scroll-mt-48"
          >
            <JobCompletionChecklistCard
              photosUploaded={photoCount > 0}
              installedSystemsEntered={installedSystemsEntered}
              jobNotesCompleted={jobNotesCompleted}
              closeoutMode={job.closeoutMode ?? "full"}
              requiresInstallGates={requiresStartupAndInstalledSystemGates({
                closeoutMode: job.closeoutMode ?? "full",
                title: job.title,
                summary: job.summary,
              })}
              finalDayBlocker={finalScheduledDayBlocker(job)}
              signatureCaption={
                latestSignature
                  ? formatSignatureCaption({
                      signerName: latestSignature.signerName,
                      capturedByName: latestSignature.capturedByName,
                      capturedAt: latestSignature.capturedAt,
                      timeZone: companyTimeZone(),
                    })
                  : null
              }
              signaturePreviewUrl={latestSignature?.previewUrl ?? null}
              initialChecklist={qaChecklist}
              onSaveChecklist={onUpdateQaChecklist}
            />
          </div>
        </div>
      </JobDetailTabPanel>

      <JobDetailTabPanel tab="photos" activeTab={activeTab}>
        <div className="space-y-3">
          <div
            id={JOB_CLOSEOUT_SECTION_IDS.photos}
            className="scroll-mt-24 rounded-3xl transition-shadow duration-500 md:scroll-mt-48"
          >
            <JobFilesPanel
              jobId={job.id}
              onFilesChanged={handleFilesChanged}
            />
          </div>

          <p className="text-center text-xs text-slate-500">
            Uploaded files:  {fileCount}
          </p>
        </div>
      </JobDetailTabPanel>

      <JobDetailTabPanel tab="systems" activeTab={activeTab}>
        {canViewJobMaterials(role) ? (
          <div className="mb-6">
            <JobTechnicalDataProvider jobId={job.id}>
              <JobTechnicalDataPanel />
            </JobTechnicalDataProvider>
          </div>
        ) : null}
        <div
          id={JOB_CLOSEOUT_SECTION_IDS.systems}
          className="scroll-mt-24 rounded-3xl transition-shadow duration-500 md:scroll-mt-48"
        >
          <JobInstalledSystemsPanel
            jobId={job.id}
            jobNumber={job.jobNumber}
            propertyId={job.propertyId ?? undefined}
            customerName={job.customerName}
            propertyName={job.propertyName}
            onCountChange={handleSystemsCount}
          />
        </div>
      </JobDetailTabPanel>

      <JobDetailTabPanel tab="activity" activeTab={activeTab}>
        <div className="space-y-6">
          <PermissionGuard table="job_notes" action="insert">
            <JobNoteComposer onAddNote={onAddNote} />
          </PermissionGuard>

          <SurfaceCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">Notes</h2>
              <p className="mt-1 text-xs text-slate-500">Newest first.</p>
              <JobNotesHistory notes={notes} legacyNotes={job.notes} activity={activity} />
            </div>
          </SurfaceCard>

          <JobTimeline activity={orderedActivity} />
          <JobDayByDay jobId={job.id} activity={orderedActivity} />
        </div>
      </JobDetailTabPanel>

      {/* Mobile tab bar: pinned to the bottom on phones, where it replaces
          the JobMobileActionBar on this screen. Start / Complete stay
          reachable from Quick Actions and the closeout panel on Overview. */}
      <div
        role="tablist"
        aria-label="Job sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {JOB_DETAIL_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`job-detail-tab-mobile-${tab.key}`}
                aria-selected={isActive}
                aria-controls={jobDetailPanelId(tab.key)}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors",
                  isActive ? "text-sky-300" : "text-slate-400 hover:text-slate-200",
                )}
              >
                <TabIcon className="h-5 w-5" />
                <span className="flex items-center gap-1">
                  {tab.mobileLabel}
                  {tab.key === "tasks" && tasksRemaining > 0 ? (
                    <span className="rounded-full bg-red-500/20 px-1.5 py-px text-[10px] font-semibold leading-tight text-red-300">
                      {tasksRemaining} left
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* F14: sticky phone action bar (Start / Mark Complete / Directions).
          Desktop renders it exactly as before (its own bar is phone-only);
          on phones the bottom tab bar above replaces it on this screen, so
          the wrapper hides it below md. The component stays mounted so its
          floating-actions lift flag keeps working for the tab bar. */}
      <div className="hidden md:block">
        <JobMobileActionBar job={job} onUpdateStatus={onUpdateStatus} />
      </div>
    </div>
  );
}
