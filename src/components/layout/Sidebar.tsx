import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  CalendarDays,
  Brain,
  BarChart3,
  Settings,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Properties", icon: Building2, href: "#" },
  { name: "Jobs", icon: Briefcase, href: "#" },
  { name: "Daily Plans", icon: CalendarDays, href: "#" },
  { name: "Company Brain", icon: Brain, href: "#" },
  { name: "Reporting", icon: BarChart3, href: "/reporting" },
  { name: "Settings", icon: Settings, href: "#" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">LOOP</h1>
        <p className="text-sm text-slate-500">
          Field Operations Platform
        </p>
      </div>

      <nav className="p-4">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
