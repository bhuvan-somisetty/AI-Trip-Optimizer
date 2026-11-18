import { Suspense } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { AppGate } from "@/components/app/app-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppGate>
      <div className="flex h-dvh w-full overflow-hidden bg-[radial-gradient(80%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary)_9%,transparent),transparent)] bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Suspense>{children}</Suspense>
          </main>
        </div>
      </div>
    </AppGate>
  );
}
