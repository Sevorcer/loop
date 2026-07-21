import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  HardHat,
  Cpu,
  CalendarDays,
  Radio,
  Package,
  Brain,
  BarChart3,
  Settings,
  BellRing,
  Send,
  Globe,
} from "lucide-react";

import type { NavGroup } from "@/features/auth";
import { ADMIN_ROUTES, PORTAL_ROUTES, ROUTES } from "@/lib/routes";

export const SHELL_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: CalendarDays },
      { name: "Live Operations", href: ROUTES.LIVE_OPERATIONS, icon: Radio },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: Send },
    ],
  },
  {
    label: "Field",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: Briefcase },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: Building2 },
      { name: "Contractors", href: ROUTES.CONTRACTORS, icon: HardHat },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: Users },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: Cpu },
      { name: "Vehicle Alerts", href: ROUTES.VEHICLE_ALERTS, icon: BellRing },
    ],
  },
  {
    label: "Resources",
    items: [
      { name: "Inventory", href: ROUTES.INVENTORY, icon: Package },
      { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: Brain },
    ],
  },
  {
    label: "Insights",
    items: [{ name: "Reporting", href: ROUTES.REPORTING, icon: BarChart3 }],
  },
  {
    label: "Administration",
    items: [{ name: "Organizations", href: ADMIN_ROUTES.ORGANIZATIONS, icon: Building2 }],
  },
  {
    label: "External",
    items: [{ name: "Project Portal", href: PORTAL_ROUTES.ROOT, icon: Globe }],
  },
  {
    label: "Workspace",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: Settings }],
  },
];
