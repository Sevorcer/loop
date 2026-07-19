import { PageHeader } from '@/components/atlas/PageHeader'
import { operationalHealthSignals, operationalHealthSummary } from './data/dashboardSnapshot'

export function DashboardHeader() {
  const userName = 'Collin'
  const currentHour = new Date().getHours()

  const getGreeting = () => {
    if (currentHour < 12) return 'Good Morning'
    if (currentHour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={operationalHealthSummary.title}
        description={operationalHealthSummary.context}
        actions={
          <span className="status-success w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            {operationalHealthSummary.status}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {operationalHealthSignals.map((signal) => {
          const Icon = signal.icon
          return (
            <div key={signal.label} className="rounded-lg border border-border bg-surface-elevated p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-muted text-xs font-semibold uppercase tracking-widest">{signal.label}</p>
              </div>
              <p className="text-primary mt-2 text-sm font-semibold sm:text-base">{signal.value}</p>
            </div>
          )
        })}
      </div>

      <p className="text-muted text-xs">
        {getGreeting()}, {userName}
      </p>
    </div>
  )
}
