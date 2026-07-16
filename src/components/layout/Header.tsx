import { Bell, Search, User } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Dashboard
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-lg p-2 hover:bg-slate-100">
          <Search size={20} />
        </button>

        <button className="rounded-lg p-2 hover:bg-slate-100">
          <Bell size={20} />
        </button>

        <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100">
          <User size={18} />
          <span className="text-sm font-medium">Collin</span>
        </button>
      </div>
    </header>
  );
}