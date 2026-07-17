import { KPICard } from '@/components/atlas/KPICard'

export function MetricsGrid() {
  const metrics = [
    { title: "Today's Jobs", value: 12 },
    { title: 'Active Crews', value: 3 },
    { title: 'Callbacks', value: 1 },
    { title: 'Open Estimates', value: 8 },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <KPICard key={metric.title} title={metric.title} value={metric.value} />
      ))}
    </div>
  )
}
