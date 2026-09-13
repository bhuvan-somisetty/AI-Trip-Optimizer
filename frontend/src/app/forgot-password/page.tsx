import { KeyRound } from "lucide-react";
import { AuthPlaceholder } from "@/components/auth-placeholder";

export default function ForgotPasswordPage() {
  return (
    <AuthPlaceholder
      icon={KeyRound}
      title="Reset your password"
      description="Password reset isn't wired up yet — contact your admin to regain access to your account."
    />
  );
}
