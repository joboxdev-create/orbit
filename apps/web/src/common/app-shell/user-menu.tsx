import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";

/** Compact account control for the navbar: identity + sign out. */
export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const label = session.user.email ?? session.user.name ?? "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 sm:flex">
        <span
          className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent"
          aria-hidden
        >
          {initial}
        </span>
        <span className="text-sm text-muted">{label}</span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="btn btn-sm" title="Sign out">
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
