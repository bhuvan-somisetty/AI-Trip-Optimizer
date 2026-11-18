"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plane, ChevronsUpDown, Settings, LogOut, Sparkles } from "lucide-react";
import { navItems } from "@/lib/nav";
import { MiniWindow } from "@/components/app/mini-window";
import { cn } from "@/lib/utils";
import { actions, useStore } from "@/lib/store";
import { initials } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const s = useStore();
  const pendingReview = s.trips.filter((t) => t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW").length;
  const drafts = s.trips.filter((t) => t.status === "DRAFT" || t.status === "OPTIMIZATION_FAILED").length;
  const sections = ["Workspace", "Insights", "Admin"] as const;

  function handleLogout() {
    actions.logout();
    router.push("/login");
  }

  return (
    <div className="grain relative flex h-full flex-col bg-sidebar bg-[radial-gradient(120%_60%_at_0%_100%,rgba(255,105,61,0.12),transparent_60%)] text-sidebar-foreground">
      <Link href="/dashboard" onClick={onNavigate} className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_24px_-6px_rgba(255,105,61,0.55)]">
          <Plane className="size-4" />
        </div>
        <div className="leading-tight">
          <span className="font-display block text-[19px] font-medium text-[#f6f0e4]">Trip Optimizer</span>
          <span className="block text-[10px] tracking-[0.16em] text-sidebar-foreground/45 uppercase">Decision workspace</span>
        </div>
      </Link>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.2em] text-sidebar-foreground/35 uppercase">{section}</p>
            {navItems
              .filter((i) => i.section === section)
              .map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const count = item.href === "/trips" ? pendingReview : item.href === "/planning" ? drafts : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-primary/25"
                        : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                          isActive ? "bg-sidebar-primary/25 text-sidebar-accent-foreground" : "bg-white/10 text-sidebar-foreground/80"
                        )}
                        title={item.href === "/trips" ? "Awaiting review" : "Drafts to optimize"}
                      >
                        {count}
                        <span className="sr-only">{item.href === "/trips" ? " awaiting review" : " drafts to optimize"}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}

        <div className="mx-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#ff693d]/[0.10] to-white/[0.02] p-3">
          <MiniWindow className="w-12 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#f6f0e4]">
              <Sparkles className="size-3.5 text-sidebar-primary" />
              Human-in-the-loop
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">
              The optimizer recommends. Your reviewers decide. Nothing books itself.
            </p>
          </div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-white/5 data-popup-open:bg-white/5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              {initials(s.session?.name ?? "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#f6f0e4]">{s.session?.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
                {s.session?.role} · {s.session?.mode === "api" ? "Connected" : "Workspace"}
              </p>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="truncate px-1.5 pb-1.5 text-sm font-medium">{s.session?.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.();
                router.push("/settings");
              }}
            >
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <SidebarBody />
    </aside>
  );
}
