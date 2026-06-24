"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateProject,
  deleteProject,
  registerConnector,
  updateConnectorInstance,
  deleteConnectorInstance,
} from "@/shared/api";

export async function updateProjectAction(
  orgId: string,
  projectId: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const result = await updateProject(projectId, {
    name: String(formData.get("name") ?? "") || undefined,
    slug: String(formData.get("slug") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`, "layout");
  return { success: true };
}

export async function deleteProjectAction(
  orgId: string,
  projectId: string,
): Promise<void> {
  await deleteProject(projectId);
  revalidatePath(`/orgs/${orgId}`, "layout");
  redirect(`/orgs/${orgId}`);
}

export async function registerConnectorAction(
  orgId: string,
  projectId: string,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const source = String(formData.get("source") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  if (source === "catalog") {
    const connectorType = String(formData.get("connectorType") ?? "").trim();
    if (!connectorType) return { error: "Select a connector from the catalog." };
    const result = await registerConnector(projectId, {
      source: "catalog",
      connectorType,
      name,
    });
    if (!result.ok) return { error: result.error };
  } else {
    const layer = String(formData.get("layer") ?? "").trim();
    if (!layer) return { error: "Select a layer." };
    const url = String(formData.get("url") ?? "").trim();
    const result = await registerConnector(projectId, {
      source: "custom",
      name,
      layer,
      config: url ? { url } : {},
    });
    if (!result.ok) return { error: result.error };
  }

  revalidatePath(`/orgs/${orgId}`, "layout");
  return { success: true };
}

export async function updateConnectorAction(
  orgId: string,
  instanceId: string,
  isCustom: boolean,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const input: { name: string; layer?: string; config?: Record<string, unknown> } =
    { name };
  if (isCustom) {
    const layer = String(formData.get("layer") ?? "").trim();
    if (!layer) return { error: "Select a layer." };
    const url = String(formData.get("url") ?? "").trim();
    input.layer = layer;
    input.config = url ? { url } : {};
  }

  const result = await updateConnectorInstance(instanceId, input);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`, "layout");
  return { success: true };
}

export async function deleteConnectorAction(
  orgId: string,
  instanceId: string,
  _prev: { error?: string; success?: boolean },
  _formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const result = await deleteConnectorInstance(instanceId);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/orgs/${orgId}`, "layout");
  return { success: true };
}
