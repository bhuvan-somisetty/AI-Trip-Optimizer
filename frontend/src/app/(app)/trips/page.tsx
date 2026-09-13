import { Plane } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function TripsPage() {
  return (
    <ComingSoon
      icon={Plane}
      title="Trips"
      description="Every trip request, its status, and its full history."
    />
  );
}
