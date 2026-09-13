import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Analytics"
      description="Total spend, average savings, and average turnaround time."
    />
  );
}
