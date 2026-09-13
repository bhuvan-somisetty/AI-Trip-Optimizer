import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend: {
    value: string;
    direction: "up" | "down";
    positive?: boolean;
  };
};

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  trend,
}: StatCardProps) {
  const isPositive = trend.positive ?? trend.direction === "up";
  const TrendIcon = trend.direction === "up" ? ArrowUp : ArrowDown;

  return (
    <Card className="gap-3 py-5">
      <CardContent className="flex items-start justify-between px-5">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isPositive ? "text-success" : "text-destructive"
            )}
          >
            <TrendIcon className="size-3" />
            {trend.value} from last month
          </p>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            iconClassName ?? "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
