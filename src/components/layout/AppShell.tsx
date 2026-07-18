import Sidebar from "./Sidebar";
import Header from "./Header";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
          <div className="absolute right-[-140px] top-[120px] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[25%] h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <Header />

        <main className="relative z-10 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}