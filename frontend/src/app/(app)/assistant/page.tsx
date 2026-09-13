import { MessageSquareText } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function AssistantPage() {
  return (
    <ComingSoon
      icon={MessageSquareText}
      title="Trip Knowledge Assistant"
      description="Ask travel-policy questions and get cited, evidence-grounded answers."
    />
  );
}
