import { KPICard } from '@/components/atlas/KPICard'
import { DASHBOARD_METRIC_DEFINITIONS } from "@/lib/operationsMetricDefinitions";
import type { DashboardSummary } from '@/repositories/dashboard'

interface MetricsGridProps {
  summary: DashboardSummary
}

export function MetricsGrid({ summary }: MetricsGridProps) {
  const metrics = [
    {
      title: DASHBOARD_METRIC_DEFINITIONS.scheduledToday.label,
      value: summary.scheduledToday,
      description: DASHBOARD_METRIC_DEFINITIONS.scheduledToday.description,
      href: DASHBOARD_METRIC_DEFINITIONS.scheduledToday.href,
      helpText: DASHBOARD_METRIC_DEFINITIONS.scheduledToday.helpText,
    },
    {
      title: DASHBOARD_METRIC_DEFINITIONS.completedToday.label,
      value: summary.completedToday,
      description: DASHBOARD_METRIC_DEFINITIONS.completedToday.description,
      href: DASHBOARD_METRIC_DEFINITIONS.completedToday.href,
      helpText: DASHBOARD_METRIC_DEFINITIONS.completedToday.helpText,
    },
    {
      title: DASHBOARD_METRIC_DEFINITIONS.onHold.label,
      value: summary.blockedJobs,
      description: DASHBOARD_METRIC_DEFINITIONS.onHold.description,
      href: DASHBOARD_METRIC_DEFINITIONS.onHold.href,
      helpText: DASHBOARD_METRIC_DEFINITIONS.onHold.helpText,
      ...(summary.blockedJobs > 0
        ? { trend: { value: "Needs attention", positive: false } }
        : {}),
    },
    {
      title: DASHBOARD_METRIC_DEFINITIONS.unassignedJobs.label,
      value: summary.unassignedJobs,
      description: DASHBOARD_METRIC_DEFINITIONS.unassignedJobs.description,
      href: DASHBOARD_METRIC_DEFINITIONS.unassignedJobs.href,
      helpText: DASHBOARD_METRIC_DEFINITIONS.unassignedJobs.helpText,
      ...(summary.unassignedJobs > 0
        ? { trend: { value: "Needs assignment", positive: false } }
        : {}),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <KPICard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          trend={metric.trend}
        />
      ))}
    </div>
  )
}
