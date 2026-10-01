import { PageHeader } from '@/components/atlas/PageHeader'; import { redirect } from 'next/navigation'; import { ROUTES } from '@/lib/routes'; import { createSupabaseServerClient } from '@/lib/supabase/server'
import { operationalHealthSignals, operationalHealthSummary } from './data/dashboardSnapshot'

export async function DashboardHeader() { const supabase = await createSupabaseServerClient(); const { data: authData } = await supabase.auth.getUser(); let userName = 'Team'; if (authData.user) { const { data: profileRow } = await supabase.from('user_profiles').select('full_name, app_role').eq('id', authData.user.id).maybeSingle(); const row = profileRow as { full_name?: string | null; app_role?: string | null } | null; if (row?.app_role === 'tech') redirect(ROUTES.JOBS); if (row && typeof row.full_name === 'string' && row.full_name.trim()) userName = row.full_name.trim(); }
  // userName resolved above from the signed-in user's own user_profiles row.
  const currentHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()))

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
        {`${getGreeting()}, ${userName}`}
      </p>
    </div>
  )
}
