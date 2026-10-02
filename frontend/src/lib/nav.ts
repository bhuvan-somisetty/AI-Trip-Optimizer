import {
  LayoutDashboard,
  Plane,
  PlusCircle,
  MessageSquareText,
  FileText,
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
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Workspace" },
  { label: "Trips", href: "/trips", icon: Plane, section: "Workspace" },
  { label: "Plan a Trip", href: "/planning", icon: PlusCircle, section: "Workspace" },
  { label: "Knowledge Assistant", href: "/assistant", icon: MessageSquareText, section: "Workspace" },
  { label: "Documents", href: "/documents", icon: FileText, section: "Workspace" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, section: "Insights" },
  { label: "Audit Trail", href: "/audit", icon: ScrollText, section: "Insights" },
  { label: "Travelers", href: "/users", icon: Users, section: "Admin" },
  { label: "Settings", href: "/settings", icon: Settings, section: "Admin" },
];
