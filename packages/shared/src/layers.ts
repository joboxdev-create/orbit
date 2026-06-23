import { z } from "zod";

/**
 * A Layer is a category of interchangeable enterprise services.
 * Every connector declares which layer it belongs to, so a project
 * can show its infrastructure grouped by concern.
 */
export const LayerKind = z.enum([
  "server", // bare hosting: Aruba, Hetzner, OVH
  "cloud", // AWS, GCP, Azure
  "infra", // Kubernetes, Docker, Compose, Terraform
  "repository", // Git, GitHub, GitLab
  "task", // Jira and alternatives
  "docs", // Confluence and alternatives
  "test", // security / integration / external test services
  "monitoring", // logs, metrics, alerting
  "email", // Gmail and enterprise alternatives
  "identity", // self-hosted auth (Keycloak, ...)
  "model", // LLM providers: local (Ollama/LM Studio) or paid (Anthropic/OpenAI)
]);
export type LayerKind = z.infer<typeof LayerKind>;

export const LAYER_LABELS: Record<LayerKind, string> = {
  server: "Server / Hosting",
  cloud: "Cloud",
  infra: "Infrastructure",
  repository: "Repository",
  task: "Task Management",
  docs: "Documentation",
  test: "Testing",
  monitoring: "Monitoring",
  email: "Email",
  identity: "Identity",
  model: "AI Models",
};
