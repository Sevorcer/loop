import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  Cpu,
  Package,
  Brain,
  BarChart3,
  Settings,
  Send,
  MonitorDot,
} from "lucide-react";

import type { NavGroup } from "@/features/auth";
import { ROUTES } from "@/lib/routes";

// Navigation groups per Sprint 7 navigation-ux-goals spec.
// Group labels use uppercase to match the spec exactly.
export const SHELL_NAV_GROUPS: NavGroup[] = [
  {
    label: "TODAY",
    items: [
      { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
      { name: "Command Center", href: ROUTES.COMMAND_CENTER, icon: MonitorDot },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: Users },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: Cpu },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: Brain },
      { name: "Inventory", href: ROUTES.INVENTORY, icon: Package },
    ],
  },
  {
    label: "INSIGHTS",
    items: [{ name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 }],
  },
  {
    label: "SETTINGS",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: Settings }],
  },
];
