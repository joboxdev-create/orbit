import { LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { NavLink } from "./nav-link";

export function Sidebar() {
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      <NavLink href="/dashboard" exact icon={<LayoutDashboard size={15} />}>
        Dashboard
      </NavLink>
      <NavLink href="/chat" icon={<MessagesSquare size={15} />}>
        Chat
      </NavLink>

      <div className="mt-auto">
        <Separator className="mb-3" />
        <NavLink href="/settings" icon={<Settings size={15} />}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
