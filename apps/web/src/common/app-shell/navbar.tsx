import { Badge } from "@/components/ui/badge";
import { Logo } from "@/common/logo";
import { UserMenu } from "./user-menu";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Logo href="/dashboard" size={30} />
        <Badge variant="outline" className="hidden md:inline-flex">
          beta
        </Badge>
      </div>
      <UserMenu />
    </header>
  );
}
