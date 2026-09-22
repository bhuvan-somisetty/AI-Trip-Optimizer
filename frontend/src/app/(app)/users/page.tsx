import { TravelerForm } from "@/components/travelers/traveler-form";

export default function UsersPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage travelers and account access for your organization.
        </p>
      </div>

      <TravelerForm />
    </div>
  );
}
