import { AlertTriangle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { attentionItems } from './data/dashboardSnapshot'

export function NeedsAttention() {
  if (attentionItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Needs Attention</CardTitle>
          <CardDescription>No critical issues at this time.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
        <CardDescription>Surface blockers and exceptions before they impact today&apos;s plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {attentionItems.map((item) => (
          <div key={item.id} className="status-warning rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-primary text-sm font-semibold">{item.title}</p>
                <p className="text-muted mt-1 text-sm">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
