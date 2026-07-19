import { Activity, CalendarDays, RefreshCcw, Users } from 'lucide-react'

export const operationalHealthSummary = {
  title: 'Operational Health',
  status: 'Healthy',
  context: 'Healthy · Dispatch on schedule · Callback queue stable',
}

export const operationalHealthSignals = [
  { label: "Today's Jobs", value: '12', icon: CalendarDays },
  { label: 'Active Crews', value: '3', icon: Users },
  { label: 'Callbacks', value: '1', icon: RefreshCcw },
  { label: 'Dispatch Status', value: 'On Schedule', icon: Activity },
]

export const attentionItems = [
  {
    id: 1,
    title: 'Callback waiting assignment',
    description: '1 callback has not been assigned to a crew yet.',
  },
  {
    id: 2,
    title: 'Inspection follow-up due today',
    description: 'Permit inspection follow-up is due before end of day.',
  },
]

export const dashboardMetrics = [
  { title: "Today's Jobs", value: 12, description: '2 high-priority visits' },
  { title: 'Active Crews', value: 3, description: 'Dispatch board balanced' },
  {
    title: 'Callbacks',
    value: 1,
    description: 'Waiting assignment',
    trend: { value: '+1 vs yesterday', positive: false },
  },
  { title: 'Open Estimates', value: 8, description: '5 due this week' },
]
