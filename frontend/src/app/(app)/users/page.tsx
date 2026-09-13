import { Users } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function UsersPage() {
  return (
    <ComingSoon
      icon={Users}
      title="Users"
      description="Manage travelers and account access for your organization."
    />
  );
}
