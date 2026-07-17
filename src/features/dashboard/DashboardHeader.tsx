import { PageHeader } from '@/components/atlas/PageHeader'

export function DashboardHeader() {
  const userName = 'Collin'
  const currentHour = new Date().getHours()

  const getGreeting = () => {
    if (currentHour < 12) return 'Good Morning'
    if (currentHour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <PageHeader
      title={`${getGreeting()}, ${userName}`}
      description="Everything is running smoothly today."
    />
  )
}
