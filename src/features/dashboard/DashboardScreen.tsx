import { DashboardHeader } from './DashboardHeader'
import { MetricsGrid } from './MetricsGrid'
import { QuickActions } from './QuickActions'
import { RecentActivity } from './RecentActivity'

export function DashboardScreen() {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      <MetricsGrid />
      <QuickActions />
      <RecentActivity />
    </div>
  )
}
