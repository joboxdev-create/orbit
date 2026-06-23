import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { Logo } from "@/components/logo";

/**
 * Email/password sign-in against ORBIT's own identity store. There is no public
 * sign-up: accounts are created by an admin. The bootstrap admin (seeded from
 * env) is the first account able to log in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <header style={{ margin: "48px 0 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <Logo size={56} wordmark={false} href="/" />
        </div>
        <h1 style={{ margin: 0 }}>Sign in to ORBIT</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Use your ORBIT account. Accounts are provisioned by an administrator.
        </p>
      </header>

      {error ? (
        <div
          className="card"
          style={{ borderColor: "#b91c1c", marginBottom: 16 }}
        >
          <p style={{ margin: 0, color: "#b91c1c" }}>Invalid email or password.</p>
        </div>
      ) : null}

      <form
        action={async (formData: FormData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: formData.get("email"),
              password: formData.get("password"),
              redirectTo: "/dashboard",
            });
          } catch (err) {
            if (err instanceof AuthError) {
              redirect("/login?error=CredentialsSignin");
            }
            throw err;
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Email
          </span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="badge" style={{ cursor: "pointer" }}>
          Sign in
        </button>
      </form>
    </main>
  );
}
