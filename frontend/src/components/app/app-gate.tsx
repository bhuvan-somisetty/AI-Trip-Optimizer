"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { useApplyTheme } from "@/components/app/theme";

/** Waits for the persisted workspace to load, enforces sign-in for app routes, and loads API data. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const router = useRouter();
  const pathname = usePathname();
  useApplyTheme(s.settings.theme);

  useEffect(() => {
    if (s.hydrated && !s.session) router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
  }, [s.hydrated, s.session, router, pathname]);

  // Runs after sign-in and on every app load with a saved API session.
  const apiToken = s.session?.mode === "api" ? s.session.token : undefined;
  useEffect(() => {
    if (s.hydrated && apiToken) void actions.syncFromApi();
  }, [s.hydrated, apiToken]);

  if (!s.hydrated || !s.session || s.syncing) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex size-11 animate-pulse items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Plane className="size-5" />
          </div>
          <p className="text-sm">Loading workspace…</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
