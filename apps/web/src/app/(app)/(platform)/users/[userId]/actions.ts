"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateUser, deleteUser } from "@/shared/api";

export async function updateUserAction(
  userId: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = String(formData.get("name") ?? "").trim() || undefined;
  const email = String(formData.get("email") ?? "").trim() || undefined;
  const platformRole =
    (String(formData.get("platformRole") ?? "").trim() || undefined) as
      | "admin"
      | "member"
      | undefined;
  const password = String(formData.get("password") ?? "").trim() || undefined;

  const result = await updateUser(userId, {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(platformRole !== undefined && { platformRole }),
    ...(password !== undefined && { password }),
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
  return { success: true };
}

export async function deleteUserAction(userId: string): Promise<void> {
  await deleteUser(userId);
  revalidatePath("/users");
  redirect("/users");
}
