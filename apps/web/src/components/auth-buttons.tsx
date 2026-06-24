import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";

/** Server-rendered sign-in / sign-out controls backed by Auth.js server actions. */
export async function AuthControls() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link href="/login" className="btn btn-sm">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="muted hidden text-sm sm:inline">
        {session.user.email ?? session.user.name}
      </span>
      <Link href="/dashboard" className="btn btn-sm btn-primary">
        <LayoutDashboard size={15} />
        Dashboard
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="btn btn-sm" title="Sign out">
          <LogOut size={15} />
        </button>
      </form>
    </div>
  );
}
