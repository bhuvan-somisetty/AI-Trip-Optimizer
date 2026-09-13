import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search trips, destinations, or documents..."
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-destructive" />
        </button>
        <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          SR
        </div>
      </div>
    </header>
  );
}
