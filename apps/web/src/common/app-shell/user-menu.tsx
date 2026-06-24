import { LogOut } from "lucide-react";
import { auth, signOut } from "@/shared/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const label = session.user.email ?? session.user.name ?? "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 sm:flex">
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="ghost" size="sm">
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
