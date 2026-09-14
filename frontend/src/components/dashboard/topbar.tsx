"use client";

import { useRouter } from "next/navigation";
import { Bell, Search, User, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const router = useRouter();

  function handleLogout() {
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
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

        <DropdownMenu>
          <DropdownMenuTrigger className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground outline-none ring-offset-2 transition-shadow focus-visible:ring-2 focus-visible:ring-ring">
            SR
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
              <div className="px-1.5 pb-1.5 text-sm font-medium">
                swetalinrout2006@gmail.com
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
