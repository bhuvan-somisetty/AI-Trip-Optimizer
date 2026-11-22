import {
  LayoutDashboard,
  Plane,
  PlusCircle,
  Search,
  BarChart3,
  ScrollText,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: "Workspace" | "Insights" | "Admin";
  /** Only shown to admins. */
  adminOnly?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Workspace" },
  { label: "Trips", href: "/trips", icon: Plane, section: "Workspace" },
  { label: "Plan a Trip", href: "/planning", icon: PlusCircle, section: "Workspace" },
  { label: "Search Transport", href: "/search", icon: Search, section: "Workspace" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, section: "Insights" },
  { label: "Travelers", href: "/users", icon: Users, section: "Admin" },
  { label: "Audit Trail", href: "/audit", icon: ScrollText, section: "Admin", adminOnly: true },
  { label: "Settings", href: "/settings", icon: Settings, section: "Admin" },
];
