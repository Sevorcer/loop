import { KPICard } from '@/components/atlas/KPICard'
import { dashboardMetrics } from './data/dashboardSnapshot'

export function MetricsGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {dashboardMetrics.map((metric) => (
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
