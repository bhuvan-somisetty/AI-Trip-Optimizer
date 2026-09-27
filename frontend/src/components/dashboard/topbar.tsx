"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search, Settings, LogOut, Menu, Moon, Sun, Plus, Plane, User, FileText, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SidebarBody } from "@/components/dashboard/sidebar";
import { actions, routeLabel, useStore } from "@/lib/store";
import { initials, timeAgo } from "@/lib/format";
import { cityByCode } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Result = { id: string; href: string; title: string; sub: string; kind: "Trip" | "Traveler" | "Document" };

export function Topbar() {
  const router = useRouter();
  const s = useStore();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const trips = s.trips
      .filter((t) =>
        [t.code, t.title, t.purpose, t.origin, t.destination, cityByCode[t.destination]?.name, cityByCode[t.origin]?.name]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 5)
      .map((t) => ({ id: t.id, href: `/trips/${t.id}`, title: `${t.code} · ${t.title}`, sub: routeLabel(t), kind: "Trip" as const }));
    const travelers = s.travelers
      .filter((t) => `${t.name} ${t.email} ${t.department}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((t) => ({ id: t.id, href: `/users?focus=${t.id}`, title: t.name, sub: `${t.department} · ${t.email}`, kind: "Traveler" as const }));
    const docs = s.docs
      .filter((d) => `${d.title} ${d.category} ${d.content}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((d) => ({ id: d.id, href: `/documents?doc=${d.id}`, title: d.title, sub: d.category, kind: "Document" as const }));
    return [...trips, ...travelers, ...docs];
  }, [query, s.trips, s.travelers, s.docs]);

  const notifications = useMemo(
    () =>
      s.audit
        .filter((a) => ["DECISION", "PIPELINE_RUN", "PIPELINE_FAILED", "ITINERARY_EDITED", "DOCUMENT_UPLOAD"].includes(a.type))
        .filter((a) => (a.type === "DECISION" ? s.settings.notifyDecisions : a.type.startsWith("PIPELINE") ? s.settings.notifyPipeline : true))
        .slice(0, 8),
    [s.audit, s.settings]
  );
  const unread = notifications.filter((n) => n.createdAt > s.readNotificationsAt).length;

  function go(href: string) {
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function handleLogout() {
    actions.logout();
    router.push("/login");
  }

  const dark = s.settings.theme === "dark";
  const kindIcon = { Trip: Plane, Traveler: User, Document: FileText };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <button
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              go(results[active].href);
            } else if (e.key === "Escape") {
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          placeholder="Search trips, travelers, documents…"
          className="h-9 pr-14 pl-9"
          aria-label="Search"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:block">
          Ctrl K
        </kbd>
        {focused && query.trim() && (
          <div className="absolute top-11 left-0 z-30 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl sm:w-[28rem]">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for “{query}”.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto p-1.5">
                {results.map((r, i) => {
                  const Icon = kindIcon[r.kind];
                  return (
                    <li key={`${r.kind}-${r.id}`}>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(r.href)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                          i === active ? "bg-accent" : "hover:bg-accent/60"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">{r.kind}</span>
                        {i === active && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Link href="/planning" className={cn(buttonVariants({ size: "lg" }), "hidden shadow-md shadow-primary/20 lg:inline-flex")}>
          <Plus />
          New trip
        </Link>

        <button
          onClick={() => actions.updateSettings({ theme: dark ? "light" : "dark" })}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>

        <DropdownMenu onOpenChange={(open) => !open && unread > 0 && actions.markNotificationsRead()}>
          <DropdownMenuTrigger
            className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-[min(92vw,22rem)] p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button className="text-xs font-medium text-primary hover:underline" onClick={() => actions.markNotificationsRead()}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto p-1.5">
              {notifications.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="items-start gap-3 rounded-lg px-2.5 py-2.5"
                  onClick={() => router.push(n.tripId ? `/trips/${n.tripId}` : "/audit")}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.createdAt > s.readNotificationsAt ? "bg-primary" : "bg-transparent"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm">{n.summary}</span>
                    <span className="block text-xs text-muted-foreground">
                      {n.actor} · {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
            <div className="border-t p-1.5">
              <DropdownMenuItem className="justify-center text-sm font-medium text-primary" onClick={() => router.push("/audit")}>
                View full audit trail
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground outline-none ring-offset-2 transition-shadow focus-visible:ring-2 focus-visible:ring-ring">
            {initials(s.session?.name ?? "U")}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
              <div className="px-1.5 pb-1.5">
                <p className="truncate text-sm font-medium">{s.session?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.session?.email}</p>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmLogoutOpen(true)}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent side="left" className="border-0 bg-sidebar p-0">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to log out of AI Trip Optimizer?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
