import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { AttentionItem } from "./data/operationalHealth";

interface NeedsAttentionProps {
  items: AttentionItem[];
}

export function NeedsAttention({ items }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Needs Attention</CardTitle>
          <CardDescription>No jobs are waiting on assignment, on hold, or open as a callback.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
        <CardDescription>Open jobs that need a person or are on hold.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={ROUTE_BUILDERS.JOB_DETAIL(item.id)}
            className="block status-warning rounded-lg p-3 transition-colors hover:bg-warning/20"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-primary text-sm font-semibold">{item.title}</p>
                <p className="text-muted mt-1 text-sm">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
