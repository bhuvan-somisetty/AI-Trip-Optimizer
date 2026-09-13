import { Mail } from "lucide-react";
import { AuthPlaceholder } from "@/components/auth-placeholder";

export default function ContactPage() {
  return (
    <AuthPlaceholder
      icon={Mail}
      title="Contact your admin"
      description="New accounts are created by your company's workspace admin. Reach out to them to get access."
    />
  );
}
