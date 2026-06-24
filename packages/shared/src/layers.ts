import { z } from "zod";

/**
 * A Layer is a category of interchangeable enterprise services. Every connector
 * declares which layer it belongs to, so a project can show its infrastructure
 * grouped by concern. Layers are organised along the software lifecycle, the
 * mental model used by enterprise internal developer portals (Backstage/Cortex):
 *
 *   SHIP        → repository, cicd
 *   RUN         → hosting, orchestration, iac, database
 *   OPERATE     → observability, security
 *   COLLABORATE → task, docs, workspace, identity
 *   AI          → model
 *
 * The enum order drives display order in the UI.
 */
export const LayerKind = z.enum([
  // ── SHIP ──────────────────────────────────────────────────────────────────
  "repository", // Source control: GitHub, GitLab, Bitbucket
  "cicd", // CI/CD pipelines: GitHub Actions, GitLab CI, Jenkins, CircleCI
  // ── RUN ───────────────────────────────────────────────────────────────────
  "hosting", // Cloud & bare hosting: AWS, GCP, Azure, Aruba, Hetzner, OVH
  "orchestration", // Containers & orchestration: Kubernetes, Docker, Nomad
  "iac", // Infrastructure as Code: Terraform, Pulumi, Ansible
  "database", // Databases & data stores: Postgres, MySQL, Redis
  // ── OPERATE ────────────────────────────────────────────────────────────────
  "observability", // Logs, metrics, traces, alerting: Datadog, Grafana, Sentry
  "security", // Security & secrets: Vault, Snyk, SonarQube
  // ── COLLABORATE ────────────────────────────────────────────────────────────
  "task", // Project management: Jira, Linear, Asana
  "docs", // Documentation: Confluence, Notion
  "workspace", // Workspace & communication: Google Workspace, M365, Slack, Teams
  "identity", // Identity & access: Keycloak, Okta, Auth0
  // ── AI ─────────────────────────────────────────────────────────────────────
  "model", // LLM providers: local (Ollama/LM Studio) or paid (Anthropic/OpenAI)
]);
export type LayerKind = z.infer<typeof LayerKind>;

export const LAYER_LABELS: Record<LayerKind, string> = {
  repository: "Repository",
  cicd: "CI/CD",
  hosting: "Cloud & Hosting",
  orchestration: "Orchestration",
  iac: "Infrastructure as Code",
  database: "Databases",
  observability: "Observability",
  security: "Security & Secrets",
  task: "Project Management",
  docs: "Documentation",
  workspace: "Workspace",
  identity: "Identity & Access",
  model: "AI Models",
};

/**
 * Macro-area each layer belongs to, for grouped rendering. Ordered to match the
 * lifecycle. Optional for consumers that only need the flat list.
 */
export const LAYER_GROUPS = {
  ship: { label: "Ship", layers: ["repository", "cicd"] },
  run: { label: "Run", layers: ["hosting", "orchestration", "iac", "database"] },
  operate: { label: "Operate", layers: ["observability", "security"] },
  collaborate: {
    label: "Collaborate",
    layers: ["task", "docs", "workspace", "identity"],
  },
  ai: { label: "AI", layers: ["model"] },
} as const satisfies Record<
  string,
  { label: string; layers: readonly LayerKind[] }
>;
