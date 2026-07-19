import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CheckCircle2, Paperclip, Users, Home } from 'lucide-react'

const activities = [
  {
    id: 1,
    title: 'Job Completed',
    description: 'AC Repair · 123 Main St',
    time: '2 hours ago',
    icon: CheckCircle2,
  },
  {
    id: 2,
    title: 'Quote Sent',
    description: 'New HVAC installation proposal',
    time: '4 hours ago',
    icon: Paperclip,
  },
  {
    id: 3,
    title: 'Crew Assigned',
    description: 'Maintenance visit scheduled for downtown office',
    time: '1 day ago',
    icon: Users,
  },
  {
    id: 4,
    title: 'Property Added',
    description: '456 Oak Avenue added to portfolio',
    time: '2 days ago',
    icon: Home,
  },
]

export function RecentActivity() {
  return (
    <Card className="hover-lift">
      <CardHeader>
        <div className="space-y-3">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>See the latest updates across your operations.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon
          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-lg border p-4 atlas-transition atlas-hover-border-primary"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-elevated)',
              }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-primary)',
                }}
              >
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {activity.title}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {activity.description}
                </p>
                <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {activity.time}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
