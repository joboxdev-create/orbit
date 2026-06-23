import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createOrganization,
  getConnectors,
  getMe,
  getOrganizations,
} from "@/lib/api";
import { AuthControls } from "@/components/auth-buttons";
import { BrandIcon } from "@/components/brand-icon";
import { Logo } from "@/components/logo";

/**
 * The real app, behind auth. Restricted to platform admins for now; user
 * onboarding and per-org access come later.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Admin-only for now.
  if (session.user.platformRole !== "admin") {
    return (
      <main className="container" style={{ maxWidth: 520 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <Logo />
          <AuthControls />
        </header>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No access yet</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Your account isn’t a platform admin. Access for regular users is
            coming soon.
          </p>
        </div>
      </main>
    );
  }

  const { error } = await searchParams;
  const [me, organizations, connectors] = await Promise.all([
    getMe(),
    getOrganizations(),
    getConnectors(),
  ]);

  return (
    <main className="container">
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <span className="badge">Dashboard</span>
        </div>
        <AuthControls />
      </header>
      <p className="muted" style={{ marginTop: 0, marginBottom: 40 }}>
        Signed in as {me?.email ?? session.user.email} · {me?.platformRole}
      </p>

      <section style={{ marginBottom: 40 }}>
        <h2>Organizations</h2>
        <p className="muted">
          The top of the model: an organization holds projects, which hold
          connector instances.
        </p>

        {organizations.length === 0 ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="muted" style={{ margin: 0 }}>
              No organizations yet. Create your first one below.
            </p>
          </div>
        ) : (
          <div className="grid" style={{ marginBottom: 16 }}>
            {organizations.map((org) => (
              <div key={org.id} className="card">
                <strong>{org.name}</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {org.slug}
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>
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
          className="card"
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Name
            </span>
            <input name="name" required placeholder="Acme Inc" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Slug
            </span>
            <input name="slug" required placeholder="acme" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
          </label>
          <button type="submit" className="badge" style={{ cursor: "pointer" }}>
            Create organization
          </button>
        </form>
      </section>

      <section>
        <h2>Available connectors</h2>
        <p className="muted">
          Connector types you can attach to a project. Keycloak is here as a
          connector (data plane), not as the login system.
        </p>
        <div className="grid">
          {connectors.map((c) => (
            <div key={c.type} className="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <BrandIcon slug={c.icon} />
                <span className="badge">{c.layer}</span>
              </div>
              <h3 style={{ margin: "10px 0 4px" }}>{c.displayName}</h3>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
