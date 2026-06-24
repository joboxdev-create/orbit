"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProject } from "@/shared/api";

export async function createProjectAction(
  orgId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const result = await createProject({
    orgId,
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`);
  redirect(`/orgs/${orgId}`);
}
