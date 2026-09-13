import Link from "next/link";
import { Plane, Clock, CheckCircle2, IndianRupee, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentTripsTable } from "@/components/dashboard/recent-trips-table";
import { TripsByStatusChart } from "@/components/dashboard/trips-by-status-chart";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good Morning, Swetalin!
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your trips.
          </p>
        </div>
        <Link
          href="/planning"
          className={cn(buttonVariants({ size: "lg" }), "w-fit")}
        >
          <Plus />
          Create New Trip
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Trips"
          value="24"
          icon={Plane}
          trend={{ value: "12%", direction: "up" }}
        />
        <StatCard
          label="Pending Approval"
          value="6"
          icon={Clock}
          iconClassName="bg-warning/15 text-warning"
          trend={{ value: "2%", direction: "down", positive: false }}
        />
        <StatCard
          label="Approved Trips"
          value="18"
          icon={CheckCircle2}
          iconClassName="bg-success/15 text-success"
          trend={{ value: "20%", direction: "up" }}
        />
        <StatCard
          label="Total Spend"
          value="₹12,40,000"
          icon={IndianRupee}
          trend={{ value: "8%", direction: "up" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Trips</CardTitle>
            <Link
              href="/trips"
              className="text-sm font-medium text-primary hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <RecentTripsTable />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trips by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TripsByStatusChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
