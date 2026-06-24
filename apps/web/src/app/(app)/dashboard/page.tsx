import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { auth } from "@/shared/auth";
import { createOrganization, getMe, getOrganizations } from "@/shared/api";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";

/**
 * Workspace home: the organizations the user owns, the entry point into the
 * Organization → Project → Layer → Connector hierarchy. Admin-only for now;
 * per-org access for regular users comes later.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  // The (app) layout already guarantees a session.
  if (session!.user.platformRole !== "admin") {
    return (
      <PageShell>
        <PageHeader title="Dashboard" />
        <div className="card max-w-lg">
          <h2 className="mt-0 text-lg">No access yet</h2>
          <p className="muted mb-0 text-sm">
            Your account isn’t a platform admin. Access for regular users is
            coming soon.
          </p>
        </div>
      </PageShell>
    );
  }

  const { error } = await searchParams;
  const [me, organizations] = await Promise.all([getMe(), getOrganizations()]);

  return (
    <PageShell
      index={[
        { id: "organizations", label: "Organizations" },
        { id: "new-organization", label: "New organization" },
      ]}
    >
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${me?.email ?? session!.user.email} · ${me?.platformRole}`}
      />

      <section id="organizations" className="scroll-mt-20">
        <h2 className="text-lg">Organizations</h2>
        <p className="muted mt-1 text-sm">
          The top of the model: an organization holds projects, which hold
          connector instances.
        </p>

        {organizations.length === 0 ? (
          <div className="card mt-4">
            <p className="muted m-0 text-sm">
              No organizations yet. Create your first one below.
            </p>
          </div>
        ) : (
          <div className="grid-cards mt-4">
            {organizations.map((org) => (
              <Link
                key={org.id}
                href={`/orgs/${org.id}`}
                className="card card-hover group flex items-center gap-3 no-underline"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                  <Building2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {org.name}
                  </span>
                  <span className="muted block truncate text-[13px]">
                    {org.slug}
                  </span>
                </span>
                <ArrowRight
                  size={16}
                  className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section id="new-organization" className="scroll-mt-20">
        <h2 className="text-lg">New organization</h2>
        {error ? (
          <p className="mt-2 text-[13px] text-danger">{error}</p>
        ) : null}
        <form
          action={async (formData: FormData) => {
            "use server";
            const result = await createOrganization({
              name: String(formData.get("name") ?? ""),
              slug: String(formData.get("slug") ?? ""),
            });
            if (!result.ok) {
              redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
            }
            revalidatePath("/dashboard");
          }}
          className="card mt-4 flex flex-wrap items-end gap-4"
        >
          <label className="field min-w-[180px] flex-1">
            <span className="field-label">Name</span>
            <input className="input" name="name" required placeholder="Acme Inc" />
          </label>
          <label className="field min-w-[180px] flex-1">
            <span className="field-label">Slug</span>
            <input
              className="input"
              name="slug"
              required
              placeholder="acme"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            <Plus size={16} />
            Create organization
          </button>
        </form>
      </section>
    </PageShell>
  );
}
