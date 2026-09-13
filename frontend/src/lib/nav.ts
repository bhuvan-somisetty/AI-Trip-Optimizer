import {
  LayoutDashboard,
  Plane,
  ClipboardList,
  MessageSquareText,
  FileText,
  BarChart3,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trips", href: "/trips", icon: Plane },
  { label: "Planning", href: "/planning", icon: ClipboardList },
  { label: "Knowledge Assistant", href: "/assistant", icon: MessageSquareText },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Users", href: "/users", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];
