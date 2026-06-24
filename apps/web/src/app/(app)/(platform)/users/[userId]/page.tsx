import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/shared/auth";
import { getUserById } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserEditForm } from "./form";
import { DeleteUserButton } from "./delete-button";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (session?.user?.platformRole !== "admin") redirect("/dashboard");

  const { userId } = await params;
  const user = await getUserById(userId);
  if (!user) notFound();

  const isSelf = session.user.email === user.email;

  return (
    <PageShell>
      <div>
        <Link
          href="/users"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} />
          Users
        </Link>
      </div>

      <PageHeader
        title={user.name ?? user.email}
        description={user.email}
        actions={
          <Badge variant={user.platformRole === "admin" ? "default" : "secondary"}>
            {user.platformRole}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">ID</p>
              <p className="font-mono text-xs break-all">{user.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Provider</p>
              <p>{user.provider}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{new Date(user.createdAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Edit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserEditForm
              userId={user.id}
              currentName={user.name}
              currentEmail={user.email}
              currentRole={user.platformRole}
            />
          </CardContent>
        </Card>
      </div>

      {!isSelf && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-destructive">
              Danger zone
            </h2>
            <Card className="border-destructive/40">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">Delete user</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently removes the account. This action cannot be
                    undone.
                  </p>
                </div>
                <DeleteUserButton userId={user.id} userName={user.name ?? user.email} />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </PageShell>
  );
}
