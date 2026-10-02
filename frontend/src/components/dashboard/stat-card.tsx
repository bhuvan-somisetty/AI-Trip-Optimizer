import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName?: string;
  hint?: string;
  trend?: {
    value: string;
    direction: "up" | "down";
    positive?: boolean;
  };
};

export function StatCard({ label, value, icon: Icon, iconClassName, trend, hint }: StatCardProps) {
  const isPositive = trend ? trend.positive ?? trend.direction === "up" : true;
  const TrendIcon = trend?.direction === "up" ? ArrowUp : ArrowDown;

  return (
    <Card className="h-full gap-3 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
      <CardContent className="flex items-start justify-between px-5">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {trend ? (
            <p className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-success" : "text-destructive")}>
              <TrendIcon className="size-3" />
              {trend.value} vs previous 30 days
            </p>
          ) : (
            hint && <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", iconClassName ?? "bg-primary/10 text-primary")}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
