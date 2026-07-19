import type { Metadata } from "next";

import { JobsProvider } from "@/features/jobs/context/JobsContext";

import "./globals.css";

export const metadata: Metadata = {
  title: "LOOP",
  description: "Field operations workflows for jobs, properties, and fleet alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-950">
        <JobsProvider>{children}</JobsProvider>
      </body>
    </html>
  );
}
