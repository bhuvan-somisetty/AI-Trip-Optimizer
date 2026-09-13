import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function PlanningPage() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Create New Trip"
      description="Tell us your travel requirements and let AI find the best options."
    />
  );
}
