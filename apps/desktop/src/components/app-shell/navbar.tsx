import { Orbit } from "lucide-react";
import { SyncDialog } from "./sync-dialog";

export function Navbar({ workspace }: { workspace: string | null }) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background px-5">
      <Orbit size={18} className="text-primary" />
      <span className="font-heading font-medium">Orbit</span>
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        Desktop
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="hidden max-w-[40ch] truncate font-mono text-xs text-muted-foreground sm:inline"
          title={workspace ?? ""}
        >
          {workspace ?? "…"}
        </span>
        <SyncDialog />
      </div>
    </header>
  );
}
