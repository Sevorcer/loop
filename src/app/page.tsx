import AppShell from "@/components/layout/AppShell";

export default function Home() {
  return (
    <AppShell>
      <div>
        <h2 className="text-3xl font-bold">Welcome to LOOP</h2>

        <p className="mt-4 text-gray-600">
          The Operating System for Field Operations
        </p>
      </div>
    </AppShell>
  );
}