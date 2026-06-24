import { Logo } from "@/components/logo";
import { UserMenu } from "./user-menu";

/**
 * Fixed top bar for the authenticated app. Stays pinned while content scrolls;
 * the shell offsets content by its height (h-14).
 */
export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Logo href="/dashboard" size={30} />
        <span className="badge hidden md:inline-flex">beta</span>
      </div>
      <UserMenu />
    </header>
  );
}
