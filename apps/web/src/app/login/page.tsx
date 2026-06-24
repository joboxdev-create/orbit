import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/shared/auth";
import { Logo } from "@/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <Logo size={48} wordmark={false} href="/" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to ORBIT
          </h1>
          <p className="text-sm text-muted-foreground">
            Use your ORBIT account. Accounts are provisioned by an
            administrator.
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Invalid email or password.
          </p>
        )}

        <form
          className="space-y-4"
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
                redirect("/login?error=1");
              }
              throw err;
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
