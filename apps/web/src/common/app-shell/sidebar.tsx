import { LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { NavLink } from "./nav-link";

/** Section label above a group of nav links. */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
      {children}
    </p>
  );
}

/**
 * Left navigation for the authenticated app. Kept deliberately lean: the global
 * nav is just the workspace destinations. Layers and connectors are
 * project-scoped, so they live inside a project's page — not here.
 */
export function Sidebar() {
  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
      <SectionLabel>Workspace</SectionLabel>
      <NavLink href="/dashboard" exact icon={<LayoutDashboard size={16} />}>
        Dashboard
      </NavLink>
      <NavLink href="/chat" icon={<MessagesSquare size={16} />}>
        Chat
      </NavLink>

      <div className="mt-auto pt-4">
        <NavLink href="/settings" icon={<Settings size={16} />}>
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
