import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <p className="font-medium">This screen is being built next.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {title} will land here once its API and UI are wired up. Check{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/26_Day_by_Day_Build_Plan.md</code>{" "}
            for the build schedule.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
