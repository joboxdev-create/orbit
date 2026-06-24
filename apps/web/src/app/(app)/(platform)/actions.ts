"use server";

import { revalidatePath } from "next/cache";
import { createOrganization } from "@/shared/api";

export async function createOrgAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const result = await createOrganization({
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  // Revalidate all layouts so the org list in the platform sidebar refreshes.
  revalidatePath("/", "layout");
  return { success: true };
}
