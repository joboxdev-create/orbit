import Link from "next/link";
import { auth, signOut } from "@/auth";

/** Server-rendered sign-in / sign-out controls backed by Auth.js server actions. */
export async function AuthControls() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link href="/login" className="badge" style={{ textDecoration: "none" }}>
        Sign in
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="muted" style={{ fontSize: 13 }}>
        {session.user.email ?? session.user.name}
      </span>
      <Link href="/dashboard" className="badge" style={{ textDecoration: "none" }}>
        Dashboard
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="badge" style={{ cursor: "pointer" }}>
          Sign out
        </button>
      </form>
    </div>
  );
}
