import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="size-6" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="text-xl font-bold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        </div>
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
