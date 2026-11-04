import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Builder Portal",
    template: "%s | LOOP Builder Portal",
  },
  description: "Secure job progress portal for builders and general contractors.",
};

/**
 * GC Portal layout — Task 2
 *
 * Clean layout with no sidebar or LOOP chrome.
 * The page is the builder's whole world.
 */
export default function GcPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-6">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            LOOP
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            Builder Portal
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
