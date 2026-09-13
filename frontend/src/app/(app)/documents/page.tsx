import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function DocumentsPage() {
  return (
    <ComingSoon
      icon={FileText}
      title="Documents"
      description="Upload the travel policies and reference documents the assistant cites."
    />
  );
}
