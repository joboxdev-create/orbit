import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { auth, signOut } from "@/shared/auth";
import { Button } from "@/components/ui/button";

export async function AuthControls() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {session.user.email ?? session.user.name}
      </span>
      <Button asChild size="sm">
        <Link href="/dashboard">
          <LayoutDashboard size={15} />
          Dashboard
        </Link>
      </Button>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="ghost" size="icon">
          <LogOut size={15} />
        </Button>
      </form>
    </div>
  );
}
