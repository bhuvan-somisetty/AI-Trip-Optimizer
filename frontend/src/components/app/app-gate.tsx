"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import { useStore } from "@/lib/store";
import { useApplyTheme } from "@/components/app/theme";

/** Waits for the persisted workspace to load, then enforces sign-in for app routes. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const s = useStore();
  const router = useRouter();
  const pathname = usePathname();
  useApplyTheme(s.settings.theme);

  useEffect(() => {
    if (s.hydrated && !s.session) router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
  }, [s.hydrated, s.session, router, pathname]);

  if (!s.hydrated || !s.session) {
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
