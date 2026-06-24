import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowRight, FolderGit2, Plus } from "lucide-react";
import {
  createProject,
  getOrganization,
  getProjects,
} from "@/shared/api";
import { Breadcrumb } from "@/common/app-shell/breadcrumb";
import { PageHeader, PageShell } from "@/common/app-shell/page-shell";

/**
 * Organization detail: the projects under a group, plus an inline form to add
 * one. Each project drills into its layers and connectors.
 */
export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId } = await params;
  const { error } = await searchParams;
  const [org, projects] = await Promise.all([
    getOrganization(orgId),
    getProjects(orgId),
  ]);
  if (!org) notFound();

  return (
    <PageShell
      index={[
        { id: "projects", label: "Projects" },
        { id: "new-project", label: "New project" },
      ]}
    >
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: org.name },
            ]}
          />
        }
        title={org.name}
        description={`Organization · ${org.slug}`}
      />

      <section id="projects" className="scroll-mt-20">
        <h2 className="text-lg">Projects</h2>
        <p className="muted mt-1 text-sm">
          A project groups the connected services for one initiative, organized
          by layer.
        </p>

        {projects.length === 0 ? (
          <div className="card mt-4">
            <p className="muted m-0 text-sm">
              No projects yet. Create the first one below.
            </p>
          </div>
        ) : (
          <div className="grid-cards mt-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/orgs/${orgId}/projects/${project.id}`}
                className="card card-hover group flex items-center gap-3 no-underline"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                  <FolderGit2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {project.name}
                  </span>
                  <span className="muted block truncate text-[13px]">
                    {project.slug}
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

      <section id="new-project" className="scroll-mt-20">
        <h2 className="text-lg">New project</h2>
        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
        <form
          action={async (formData: FormData) => {
            "use server";
            const result = await createProject({
              orgId,
              name: String(formData.get("name") ?? ""),
              slug: String(formData.get("slug") ?? ""),
              description: String(formData.get("description") ?? "") || undefined,
            });
            if (!result.ok) {
              redirect(
                `/orgs/${orgId}?error=${encodeURIComponent(result.error)}`,
              );
            }
            revalidatePath(`/orgs/${orgId}`);
          }}
          className="card mt-4 flex flex-wrap items-end gap-4"
        >
          <label className="field min-w-[160px] flex-1">
            <span className="field-label">Name</span>
            <input
              className="input"
              name="name"
              required
              placeholder="Platform"
            />
          </label>
          <label className="field min-w-[160px] flex-1">
            <span className="field-label">Slug</span>
            <input
              className="input"
              name="slug"
              required
              placeholder="platform"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </label>
          <label className="field min-w-full">
            <span className="field-label">Description (optional)</span>
            <input
              className="input"
              name="description"
              placeholder="What this project covers"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            <Plus size={16} />
            Create project
          </button>
        </form>
      </section>
    </PageShell>
  );
}
