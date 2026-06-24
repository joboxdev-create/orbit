import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/shared/auth";
import { Logo } from "@/common/logo";

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
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <div className="mb-4">
            <Logo size={56} wordmark={false} href="/" />
          </div>
          <h1 className="m-0 text-2xl">Sign in to ORBIT</h1>
          <p className="muted mt-1.5 text-sm">
            Use your ORBIT account. Accounts are provisioned by an administrator.
          </p>
        </header>

        {error ? (
          <div className="card mb-4 border-danger/50">
            <p className="m-0 text-sm text-danger">Invalid email or password.</p>
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
          className="flex flex-col gap-4"
        >
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          <button type="submit" className="btn btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
