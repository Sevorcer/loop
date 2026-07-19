import type {
  PerformanceModel,
  KpiDefinition,
  Trend,
  Benchmark,
  Scorecard,
  HealthIndicator,
  PerformanceSummary,
  ComparisonWindow,
} from "../types/reporting";

// ─── Performance Models ───────────────────────────────────────────────────────

export const mockPerformanceModels: PerformanceModel[] = [
  {
    id: "pm-001",
    title: "Company Operations Performance",
    description:
      "Overall performance intelligence for field operations. Tracks the health of core operational domains: readiness, dispatch, callbacks, and crew productivity.",
    owner: "Owner",
    status: "active",
    scope: "company",
    relatedDomains: [
      "Morning Operations",
      "Dispatch",
      "Live Operations",
      "Inventory",
    ],
    defaultComparisonWindow: "last-7-days",
    benchmarkConfig: {
      defaultType: "prior-period",
      priorPeriodDays: 30,
    },
    healthScoringRules: [
      { kpiId: "kpi-001", weight: 0.25 },
      { kpiId: "kpi-002", weight: 0.25 },
      { kpiId: "kpi-003", weight: 0.3 },
      { kpiId: "kpi-004", weight: 0.2 },
    ],
    createdAt: "2026-07-01",
    updatedAt: "2026-07-19",
  },
  {
    id: "pm-002",
    title: "Morning Readiness Performance",
    description:
      "Tracks daily readiness quality over time. Measures whether the company is consistently prepared to begin operations each morning.",
    owner: "Operations Manager",
    status: "active",
    scope: "function",
    relatedDomains: ["Morning Operations"],
    defaultComparisonWindow: "last-7-days",
    benchmarkConfig: {
      defaultType: "target",
      priorPeriodDays: 14,
    },
    healthScoringRules: [
      { kpiId: "kpi-005", weight: 0.5 },
      { kpiId: "kpi-006", weight: 0.3 },
      { kpiId: "kpi-007", weight: 0.2 },
    ],
    createdAt: "2026-07-01",
    updatedAt: "2026-07-19",
  },
  {
    id: "pm-003",
    title: "Dispatch & Crew Performance",
    description:
      "Monitors scheduling efficiency, crew utilization patterns, and dispatchability trends. Identifies where coordination friction is reducing throughput.",
    owner: "Dispatch Leadership",
    status: "active",
    scope: "function",
    relatedDomains: ["Dispatch", "Morning Operations"],
    defaultComparisonWindow: "month-to-date",
    benchmarkConfig: {
      defaultType: "company-average",
      priorPeriodDays: 30,
    },
    healthScoringRules: [
      { kpiId: "kpi-002", weight: 0.5 },
      { kpiId: "kpi-004", weight: 0.5 },
    ],
    createdAt: "2026-07-01",
    updatedAt: "2026-07-19",
  },
];

// ─── KPI Definitions ─────────────────────────────────────────────────────────

export const mockKpiDefinitions: KpiDefinition[] = [
  {
    id: "kpi-001",
    performanceModelId: "pm-001",
    name: "Morning Readiness Score",
    purpose:
      "Measures the percentage of mornings where all crews, vehicles, and materials were ready at dispatch time. A lagging indicator of operational preparation quality.",
    formula: "Ready Days / Total Scheduled Days × 100",
    sourceDomains: ["Morning Operations"],
    calculationRules:
      "A day is 'ready' when all active crews have confirmed vehicle readiness, equipment readiness, and no outstanding material blockers at or before dispatch window open.",
    units: "percent",
    thresholds: { healthy: 90, atRisk: 80, deteriorating: 70, direction: "higher-is-better" },
    status: "active",
  },
  {
    id: "kpi-002",
    performanceModelId: "pm-001",
    name: "Dispatch Efficiency",
    purpose:
      "Measures what percentage of scheduled jobs were dispatched on time without same-day delays or reassignments. Reflects scheduling quality and crew reliability.",
    formula: "On-Time Dispatches / Total Scheduled Dispatches × 100",
    sourceDomains: ["Dispatch"],
    calculationRules:
      "A dispatch is 'on time' when the job is activated within 15 minutes of the scheduled dispatch window. Reassignments count as delays unless initiated more than 24 hours in advance.",
    units: "percent",
    thresholds: { healthy: 88, atRisk: 78, deteriorating: 68, direction: "higher-is-better" },
    status: "active",
  },
  {
    id: "kpi-003",
    performanceModelId: "pm-001",
    name: "Callback Rate",
    purpose:
      "Measures how often completed jobs require a return visit within 30 days. A declining callback rate signals improving install quality and service accuracy.",
    formula: "Callbacks Within 30 Days / Completed Jobs × 100",
    sourceDomains: ["Live Operations"],
    calculationRules:
      "A callback is recorded when a job is created referencing a previously completed job for the same system, within 30 calendar days of completion. Scheduled maintenance visits are excluded.",
    units: "percent",
    thresholds: { healthy: 4, atRisk: 8, deteriorating: 12, direction: "lower-is-better" },
    status: "active",
  },
  {
    id: "kpi-004",
    performanceModelId: "pm-001",
    name: "Crew Productivity Score",
    purpose:
      "Measures average jobs completed per active crew per week. Normalizes for crew count to reveal true throughput trends.",
    formula: "Total Jobs Completed / Active Crews / Working Days × 5",
    sourceDomains: ["Dispatch", "Live Operations"],
    calculationRules:
      "Active crews are those with at least one dispatched job in the week. Only completed jobs count — jobs cancelled, postponed, or still in progress are excluded. Score is normalized to a 5-day week.",
    units: "ratio",
    thresholds: { healthy: 4.5, atRisk: 3.5, deteriorating: 2.5, direction: "higher-is-better" },
    status: "active",
  },
  {
    id: "kpi-005",
    performanceModelId: "pm-002",
    name: "Day Readiness Rate",
    purpose:
      "Percentage of mornings where operations confirmed ready-to-dispatch status without any open blockers. The clearest signal of morning operations health.",
    formula: "Confirmed Ready Mornings / Total Mornings × 100",
    sourceDomains: ["Morning Operations"],
    calculationRules:
      "A morning is 'confirmed ready' when the duty officer or morning coordinator marks the day as open for dispatch. Days with any unresolved critical blocker at dispatch window open are marked not-ready.",
    units: "percent",
    thresholds: { healthy: 92, atRisk: 82, deteriorating: 72, direction: "higher-is-better" },
    status: "active",
  },
  {
    id: "kpi-006",
    performanceModelId: "pm-002",
    name: "Equipment Readiness Score",
    purpose:
      "Measures the percentage of fleet vehicles and crew equipment confirmed ready at morning check-in. Leading indicator of morning operational friction.",
    formula: "Ready Assets / Total Scheduled Assets × 100",
    sourceDomains: ["Morning Operations"],
    calculationRules:
      "Assets are checked at morning inspection. Vehicles requiring same-day maintenance, equipment with open alerts, or tools flagged as unavailable count against the score.",
    units: "percent",
    thresholds: { healthy: 95, atRisk: 85, deteriorating: 75, direction: "higher-is-better" },
    status: "active",
  },
  {
    id: "kpi-007",
    performanceModelId: "pm-002",
    name: "Material Readiness at Dispatch",
    purpose:
      "Measures whether required materials were staged and confirmed available at the point of dispatch. Inventory shortages that delay dispatch are the primary failure mode.",
    formula: "Jobs With Full Material Readiness / Total Dispatched Jobs × 100",
    sourceDomains: ["Morning Operations", "Inventory"],
    calculationRules:
      "A job has full material readiness when all line-item materials in the work order are confirmed allocated and staged before the dispatch window. Partial allocations do not count.",
    units: "percent",
    thresholds: { healthy: 90, atRisk: 80, deteriorating: 70, direction: "higher-is-better" },
    status: "active",
  },
];

// ─── Trends ───────────────────────────────────────────────────────────────────

export const mockTrends: Trend[] = [
  {
    id: "trend-001",
    performanceModelId: "pm-001",
    kpiId: "kpi-001",
    direction: "improving",
    periodStart: "2026-06-19",
    periodEnd: "2026-07-19",
    dataPoints: [
      { date: "2026-06-19", value: 74 },
      { date: "2026-06-26", value: 77 },
      { date: "2026-07-03", value: 80 },
      { date: "2026-07-10", value: 84 },
      { date: "2026-07-17", value: 86 },
      { date: "2026-07-19", value: 87 },
    ],
    rateOfChange: 17.6,
    velocityLabel: "steadily improving",
    interpretation:
      "Morning readiness has improved 17.6% over the past 30 days, rising from 74% to 87%. The trend is consistent, suggesting the readiness process improvements implemented in early July are working.",
  },
  {
    id: "trend-002",
    performanceModelId: "pm-001",
    kpiId: "kpi-002",
    direction: "stable",
    periodStart: "2026-06-19",
    periodEnd: "2026-07-19",
    dataPoints: [
      { date: "2026-06-19", value: 83 },
      { date: "2026-06-26", value: 85 },
      { date: "2026-07-03", value: 82 },
      { date: "2026-07-10", value: 86 },
      { date: "2026-07-17", value: 84 },
      { date: "2026-07-19", value: 84 },
    ],
    rateOfChange: 1.2,
    velocityLabel: "holding steady",
    interpretation:
      "Dispatch efficiency has been stable around 84% for the past 30 days. The metric is above the at-risk threshold but has not reached the healthy target of 88%. A modest improvement effort could move this into the healthy range.",
  },
  {
    id: "trend-003",
    performanceModelId: "pm-001",
    kpiId: "kpi-003",
    direction: "improving",
    periodStart: "2026-06-19",
    periodEnd: "2026-07-19",
    dataPoints: [
      { date: "2026-06-19", value: 9.2 },
      { date: "2026-06-26", value: 8.7 },
      { date: "2026-07-03", value: 7.8 },
      { date: "2026-07-10", value: 6.9 },
      { date: "2026-07-17", value: 6.1 },
      { date: "2026-07-19", value: 5.8 },
    ],
    rateOfChange: -37,
    velocityLabel: "rapidly improving",
    interpretation:
      "Callback rate has dropped 37% over the past 30 days, from 9.2% to 5.8%. This is a strong positive signal. The rate is still above the healthy threshold of 4%, but the trajectory suggests it could reach healthy territory within 2–3 weeks if the trend holds.",
  },
  {
    id: "trend-004",
    performanceModelId: "pm-001",
    kpiId: "kpi-004",
    direction: "improving",
    periodStart: "2026-06-19",
    periodEnd: "2026-07-19",
    dataPoints: [
      { date: "2026-06-19", value: 3.8 },
      { date: "2026-06-26", value: 3.9 },
      { date: "2026-07-03", value: 4.1 },
      { date: "2026-07-10", value: 4.2 },
      { date: "2026-07-17", value: 4.3 },
      { date: "2026-07-19", value: 4.4 },
    ],
    rateOfChange: 15.8,
    velocityLabel: "gradually improving",
    interpretation:
      "Crew productivity has risen 15.8% over the past 30 days, crossing the at-risk threshold and approaching the healthy range. The improvement is gradual and consistent, not driven by a single spike.",
  },
  {
    id: "trend-005",
    performanceModelId: "pm-002",
    kpiId: "kpi-007",
    direction: "declining",
    periodStart: "2026-06-19",
    periodEnd: "2026-07-19",
    dataPoints: [
      { date: "2026-06-19", value: 91 },
      { date: "2026-06-26", value: 89 },
      { date: "2026-07-03", value: 87 },
      { date: "2026-07-10", value: 85 },
      { date: "2026-07-17", value: 83 },
      { date: "2026-07-19", value: 82 },
    ],
    rateOfChange: -9.9,
    velocityLabel: "gradually declining",
    interpretation:
      "Material readiness at dispatch has declined 9.9% over the past 30 days. The metric has fallen from healthy territory into the at-risk range. The pattern suggests an inventory staging or allocation process issue that is worsening over time.",
  },
];

// ─── Benchmarks ───────────────────────────────────────────────────────────────

export const mockBenchmarks: Benchmark[] = [
  {
    id: "bench-001",
    performanceModelId: "pm-001",
    kpiId: "kpi-001",
    type: "target",
    comparisonValue: 90,
    comparisonLabel: "Target",
    currentValue: 87,
    variance: -3,
    variancePercent: -3.3,
    interpretation: "3 points below target. Trending in the right direction — at current rate, target could be reached within 2 weeks.",
  },
  {
    id: "bench-002",
    performanceModelId: "pm-001",
    kpiId: "kpi-001",
    type: "prior-period",
    comparisonValue: 74,
    comparisonLabel: "Prior 30 Days",
    currentValue: 87,
    variance: 13,
    variancePercent: 17.6,
    interpretation: "17.6% above prior period. Significant improvement over last month.",
  },
  {
    id: "bench-003",
    performanceModelId: "pm-001",
    kpiId: "kpi-002",
    type: "target",
    comparisonValue: 88,
    comparisonLabel: "Target",
    currentValue: 84,
    variance: -4,
    variancePercent: -4.5,
    interpretation: "4 points below target. Stable trend — improvement requires addressing root cause of late dispatches.",
  },
  {
    id: "bench-004",
    performanceModelId: "pm-001",
    kpiId: "kpi-003",
    type: "expected-threshold",
    comparisonValue: 4,
    comparisonLabel: "Healthy Threshold",
    currentValue: 5.8,
    variance: 1.8,
    variancePercent: 45,
    interpretation: "Still 45% above the healthy threshold, but the rapid improvement trend means this gap is closing quickly.",
  },
  {
    id: "bench-005",
    performanceModelId: "pm-001",
    kpiId: "kpi-004",
    type: "target",
    comparisonValue: 4.5,
    comparisonLabel: "Target",
    currentValue: 4.4,
    variance: -0.1,
    variancePercent: -2.2,
    interpretation: "Within 0.1 of healthy target. Crew productivity is nearly at the healthy range.",
  },
];

// ─── Scorecards ───────────────────────────────────────────────────────────────

export const mockScorecards: Scorecard[] = [
  {
    id: "sc-001",
    performanceModelId: "pm-001",
    title: "Operations Leadership Scorecard",
    description:
      "A summary of company-wide operational performance for owner and operations management review.",
    audience: "Owner",
    kpiIds: ["kpi-001", "kpi-002", "kpi-003", "kpi-004"],
    healthSummary:
      "Operations are broadly improving. Morning readiness and callback rate show the strongest positive momentum. Dispatch efficiency remains stable but has not broken through to healthy territory. Material readiness is declining and warrants attention.",
    actionItems: [
      "Investigate dispatch efficiency blockers — identify why 16% of dispatches are delayed",
      "Review inventory staging process — material readiness at dispatch has dropped 10% in 30 days",
      "Continue morning readiness process — the improvement is working and should be maintained",
    ],
    lastUpdated: "2026-07-19",
    status: "active",
  },
  {
    id: "sc-002",
    performanceModelId: "pm-002",
    title: "Morning Operations Scorecard",
    description:
      "Weekly readiness summary for the operations manager and morning coordination team.",
    audience: "Operations Manager",
    kpiIds: ["kpi-005", "kpi-006", "kpi-007"],
    healthSummary:
      "Morning readiness is trending upward. Day readiness rate and equipment readiness are both in improving territory. Material readiness at dispatch is the primary concern — it has been declining steadily and is now at risk.",
    actionItems: [
      "Escalate material staging concern to inventory team — jobs are arriving at dispatch without full material confirmation",
      "Maintain current morning check-in process — equipment readiness is strong",
    ],
    lastUpdated: "2026-07-19",
    status: "active",
  },
];

// ─── Health Indicators ────────────────────────────────────────────────────────

export const mockHealthIndicators: HealthIndicator[] = [
  {
    id: "hi-001",
    performanceModelId: "pm-001",
    kpiId: "kpi-001",
    area: "Morning Readiness",
    status: "improving",
    summary: "Improving steadily — up 17.6% over the past 30 days",
    detail:
      "Morning readiness has risen from 74% to 87% over the past month. The metric is still 3 points below the healthy target of 90%, but the consistent upward trajectory suggests the current process is working.",
    requiresAttention: false,
    lastUpdated: "2026-07-19",
  },
  {
    id: "hi-002",
    performanceModelId: "pm-001",
    kpiId: "kpi-002",
    area: "Dispatch Efficiency",
    status: "at-risk",
    summary: "Stable but below target — 84% vs 88% target",
    detail:
      "Dispatch efficiency has been consistent around 84% for the past 30 days. The metric is above the at-risk threshold but has not reached the healthy target. The stability suggests a structural bottleneck rather than a variable problem.",
    requiresAttention: true,
    lastUpdated: "2026-07-19",
  },
  {
    id: "hi-003",
    performanceModelId: "pm-001",
    kpiId: "kpi-003",
    area: "Callback Rate",
    status: "improving",
    summary: "Strong improvement — down 37% over the past 30 days",
    detail:
      "Callback rate has dropped from 9.2% to 5.8% — a significant reduction. The rate is still above the 4% healthy threshold, but the trajectory is strong. If the trend continues, the metric should reach healthy territory within 2–3 weeks.",
    requiresAttention: false,
    lastUpdated: "2026-07-19",
  },
  {
    id: "hi-004",
    performanceModelId: "pm-001",
    kpiId: "kpi-004",
    area: "Crew Productivity",
    status: "improving",
    summary: "Approaching healthy range — 4.4 vs 4.5 target",
    detail:
      "Crew productivity has risen 15.8% over the past 30 days and is now within 0.1 of the healthy target. The improvement is gradual and consistent across crews rather than driven by a single outlier.",
    requiresAttention: false,
    lastUpdated: "2026-07-19",
  },
  {
    id: "hi-005",
    performanceModelId: "pm-002",
    kpiId: "kpi-007",
    area: "Material Readiness at Dispatch",
    status: "at-risk",
    summary: "Declining — down 9.9% over 30 days, now at 82%",
    detail:
      "Material readiness at dispatch has slipped from 91% to 82% over the past 30 days. The decline is steady, suggesting a systematic issue rather than isolated incidents. Jobs are arriving at dispatch without full material confirmation.",
    requiresAttention: true,
    lastUpdated: "2026-07-19",
  },
  {
    id: "hi-006",
    performanceModelId: "pm-002",
    kpiId: "kpi-006",
    area: "Equipment Readiness",
    status: "healthy",
    summary: "Healthy — 96% equipment readiness at morning check-in",
    detail:
      "Equipment readiness is strong. Vehicles and crew tools are being confirmed ready at morning check-in at a 96% rate, above the 95% healthy threshold.",
    requiresAttention: false,
    lastUpdated: "2026-07-19",
  },
];

// ─── Performance Summaries ────────────────────────────────────────────────────

export const mockPerformanceSummaries: PerformanceSummary[] = [
  {
    id: "ps-001",
    performanceModelId: "pm-001",
    period: "July 2026",
    headline:
      "Operations improving across most dimensions — material readiness is the primary risk area requiring attention.",
    interpretation:
      "July has been a month of genuine operational improvement. Morning readiness and callback rate are both trending strongly upward, and crew productivity is nearly at its healthy target. Dispatch efficiency remains stable but below target, suggesting a structural issue that has not yet been addressed. The most pressing concern is a 30-day decline in material readiness at dispatch — this pattern needs to be investigated before it affects throughput.",
    highlights: [
      "Morning readiness improved 17.6% — the strongest single-metric gain this period",
      "Callback rate declined 37%, the largest quality improvement in 60 days",
      "Crew productivity rose 15.8% and is now within 0.1 of the healthy target",
    ],
    concerns: [
      "Material readiness at dispatch declined 9.9% — now in at-risk territory",
      "Dispatch efficiency remains 4 points below the 88% healthy target",
    ],
    generatedAt: "2026-07-19",
  },
  {
    id: "ps-002",
    performanceModelId: "pm-002",
    period: "Week of July 14, 2026",
    headline:
      "Morning operations strong in readiness and equipment — material staging is a growing concern.",
    interpretation:
      "This week's morning operations were generally solid. Day readiness was confirmed every morning, and equipment readiness held above 95%. The concern is material staging: three jobs this week arrived at dispatch without full material confirmation, and the trend has been worsening for four consecutive weeks.",
    highlights: [
      "Day readiness confirmed every morning this week — 7 for 7",
      "Equipment readiness at 96%, above the healthy threshold",
    ],
    concerns: [
      "Material readiness at dispatch slipped to 82% — third consecutive week of decline",
      "Three jobs dispatched with incomplete material staging — one required a same-day return trip for materials",
    ],
    generatedAt: "2026-07-19",
  },
];

// ─── Comparison Windows ───────────────────────────────────────────────────────

export const mockComparisonWindows: ComparisonWindow[] = [
  {
    id: "cw-001",
    performanceModelId: "pm-001",
    scope: "last-7-days",
    label: "Last 7 Days",
    startDate: "2026-07-12",
    endDate: "2026-07-19",
    isDefault: true,
  },
  {
    id: "cw-002",
    performanceModelId: "pm-001",
    scope: "month-to-date",
    label: "Month to Date",
    startDate: "2026-07-01",
    endDate: "2026-07-19",
    isDefault: false,
  },
  {
    id: "cw-003",
    performanceModelId: "pm-001",
    scope: "quarter-to-date",
    label: "Quarter to Date",
    startDate: "2026-07-01",
    endDate: "2026-07-19",
    isDefault: false,
  },
  {
    id: "cw-004",
    performanceModelId: "pm-002",
    scope: "this-week",
    label: "This Week",
    startDate: "2026-07-14",
    endDate: "2026-07-19",
    isDefault: true,
  },
  {
    id: "cw-005",
    performanceModelId: "pm-002",
    scope: "last-7-days",
    label: "Last 7 Days",
    startDate: "2026-07-12",
    endDate: "2026-07-19",
    isDefault: false,
  },
];
