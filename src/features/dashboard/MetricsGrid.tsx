import { KPICard } from '@/components/atlas/KPICard'
import type { DashboardSummary } from '@/repositories/dashboard'

interface MetricsGridProps {
  summary: DashboardSummary
}

export function MetricsGrid({ summary }: MetricsGridProps) {
  const metrics = [
    {
      title: "Scheduled Today",
      value: summary.scheduledToday,
      description: "Jobs scheduled for today",
    },
    {
      title: "Completed Today",
      value: summary.completedToday,
      description: "Jobs finished today",
    },
    {
      title: "Blocked / On Hold",
      value: summary.blockedJobs,
      description: "Jobs awaiting action",
      ...(summary.blockedJobs > 0
        ? { trend: { value: "Needs attention", positive: false } }
        : {}),
    },
    {
      title: "Unassigned Jobs",
      value: summary.unassignedJobs,
      description: "Open jobs without a technician",
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
