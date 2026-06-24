"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createOrganization } from "@/shared/api";

export async function createOrgAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const result = await createOrganization({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
