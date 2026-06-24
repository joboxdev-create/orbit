"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProject,
  updateOrganization,
  deleteOrganization,
} from "@/shared/api";

export async function createProjectAction(
  orgId: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const result = await createProject({
    orgId,
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`, "layout");
  return { success: true };
}

export async function updateOrgAction(
  orgId: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const result = await updateOrganization(orgId, {
    name: String(formData.get("name") ?? "") || undefined,
    slug: String(formData.get("slug") ?? "") || undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`, "layout");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteOrgAction(orgId: string): Promise<void> {
  await deleteOrganization(orgId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
