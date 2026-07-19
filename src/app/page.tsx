import Link from "next/link";
import { BellRing, Briefcase, Building2 } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/atlas";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

const shortcuts = [
  {
    title: "Jobs",
    description: "Review scheduled work, update field status, and capture new jobs.",
    href: "/jobs",
    icon: Briefcase,
  },
  {
    title: "Vehicle Alerts",
    description: "See fleet issues reported by field teams and office follow-up items.",
    href: "/vehicle-alerts",
    icon: BellRing,
  },
  {
    title: "Properties",
    description: "Property workflows are staged next after job execution coverage.",
    href: "#",
    icon: Building2,
  },
];

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Welcome to LOOP"
          description="Use the workspace to manage field execution, from job intake and dispatch through fleet follow-up and property context."
          actions={
            <Link href="/jobs">
              <Button>Open Jobs</Button>
            </Link>
          }
        />

        <SectionCard
          title="Operations shortcuts"
          description="Jump into the active product areas available in this build."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;

              return (
                <div
                  key={shortcut.title}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">
                    {shortcut.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {shortcut.description}
                  </p>
                  {shortcut.href !== "#" ? (
                    <Link
                      href={shortcut.href}
                      className="mt-4 inline-flex text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                    >
                      Open {shortcut.title}
                    </Link>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">Coming soon</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
