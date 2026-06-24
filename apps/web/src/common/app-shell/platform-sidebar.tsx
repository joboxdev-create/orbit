import {
  LayoutDashboard,
  MessageSquare,
  Network,
  Users,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Organization } from "@/shared/api";
import { NavLink } from "./nav-link";
import { CreateOrgDialog } from "./create-org-dialog";

interface PlatformSidebarProps {
  orgs: Organization[];
}

export function PlatformSidebar({ orgs }: PlatformSidebarProps) {
  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Platform
      </p>

      <NavLink href="/dashboard" exact icon={<LayoutDashboard size={15} />}>
        Dashboard
      </NavLink>
      <NavLink href="/graph" icon={<Network size={15} />}>
        Graph
      </NavLink>
      <NavLink href="/chat" icon={<MessageSquare size={15} />}>
        Chat
      </NavLink>
      <NavLink href="/users" icon={<Users size={15} />}>
        Users
      </NavLink>

      <Separator className="my-2" />

      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Organizations
        </p>
        <CreateOrgDialog />
      </div>

      {orgs.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No organizations yet.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {orgs.map((org) => (
            <NavLink key={org.id} href={`/orgs/${org.id}`}>
              {org.name}
            </NavLink>
          ))}
        </div>
      )}

      <div className="mt-auto">
        <Separator className="mb-2" />
        <NavLink href="/settings" icon={<Settings size={15} />}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
