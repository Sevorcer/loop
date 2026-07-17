import { Bell, Search, User } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-surface border-default flex h-16 items-center justify-between border-b px-6">

      {/* Left Side */}
      <div className="space-y-1">
        <h1 className="text-primary text-xl font-semibold tracking-tight">
          Dashboard
        </h1>

        <p className="text-muted text-sm">
          Welcome back. Here's what's happening today.
        </p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2">

        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
        >
          <Search size={18} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </Button>

        <Button
          variant="secondary"
          className="gap-2"
        >
          <User size={18} />

          <span>Collin</span>
        </Button>

      </div>

    </header>
  );
}