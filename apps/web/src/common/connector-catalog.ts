import type { LayerKind } from "@orbit/shared";

/**
 * Curated marketplace of known enterprise tools, organised by layer. This paints
 * the connector roadmap ("view from above"): entries with a `connectorType` have
 * a real code-backed connector (`@orbit/connector-*`) and are actually usable;
 * the others are visual placeholders to be implemented over time. `slug` is the
 * Simple Icons slug consumed by <BrandIcon> (must exist in its map to render).
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  layer: LayerKind;
  /** Set when a real connector exists; matched against the core registry. */
  connectorType?: string;
}

export const CONNECTOR_CATALOG: CatalogEntry[] = [
  // ── repository ──────────────────────────────────────────────────────────────
  { slug: "github", name: "GitHub", layer: "repository", connectorType: "github" },
  { slug: "gitlab", name: "GitLab", layer: "repository" },
  { slug: "bitbucket", name: "Bitbucket", layer: "repository" },
  // ── cicd ────────────────────────────────────────────────────────────────────
  { slug: "githubactions", name: "GitHub Actions", layer: "cicd" },
  { slug: "jenkins", name: "Jenkins", layer: "cicd" },
  { slug: "circleci", name: "CircleCI", layer: "cicd" },
  { slug: "argo", name: "Argo CD", layer: "cicd" },
  // ── hosting ─────────────────────────────────────────────────────────────────
  { slug: "amazonwebservices", name: "AWS", layer: "hosting" },
  { slug: "googlecloud", name: "Google Cloud", layer: "hosting" },
  { slug: "hetzner", name: "Hetzner", layer: "hosting" },
  { slug: "ovh", name: "OVH", layer: "hosting" },
  { slug: "digitalocean", name: "DigitalOcean", layer: "hosting" },
  { slug: "cloudflare", name: "Cloudflare", layer: "hosting" },
  { slug: "vercel", name: "Vercel", layer: "hosting" },
  { slug: "netlify", name: "Netlify", layer: "hosting" },
  // ── orchestration ───────────────────────────────────────────────────────────
  { slug: "kubernetes", name: "Kubernetes", layer: "orchestration" },
  { slug: "docker", name: "Docker", layer: "orchestration" },
  { slug: "nomad", name: "Nomad", layer: "orchestration" },
  { slug: "helm", name: "Helm", layer: "orchestration" },
  { slug: "proxmox", name: "Proxmox", layer: "orchestration" },
  // ── iac ─────────────────────────────────────────────────────────────────────
  { slug: "terraform", name: "Terraform", layer: "iac" },
  { slug: "pulumi", name: "Pulumi", layer: "iac" },
  { slug: "ansible", name: "Ansible", layer: "iac" },
  // ── database ────────────────────────────────────────────────────────────────
  { slug: "postgresql", name: "PostgreSQL", layer: "database" },
  { slug: "mysql", name: "MySQL", layer: "database" },
  { slug: "mariadb", name: "MariaDB", layer: "database" },
  { slug: "redis", name: "Redis", layer: "database" },
  { slug: "mongodb", name: "MongoDB", layer: "database" },
  { slug: "elasticsearch", name: "Elasticsearch", layer: "database" },
  // ── observability ───────────────────────────────────────────────────────────
  { slug: "grafana", name: "Grafana", layer: "observability" },
  { slug: "prometheus", name: "Prometheus", layer: "observability" },
  { slug: "datadog", name: "Datadog", layer: "observability" },
  { slug: "sentry", name: "Sentry", layer: "observability" },
  { slug: "newrelic", name: "New Relic", layer: "observability" },
  { slug: "pagerduty", name: "PagerDuty", layer: "observability" },
  { slug: "opsgenie", name: "Opsgenie", layer: "observability" },
  // ── security ────────────────────────────────────────────────────────────────
  { slug: "vault", name: "HashiCorp Vault", layer: "security" },
  { slug: "snyk", name: "Snyk", layer: "security" },
  { slug: "sonarqube", name: "SonarQube", layer: "security" },
  { slug: "trivy", name: "Trivy", layer: "security" },
  { slug: "dependabot", name: "Dependabot", layer: "security" },
  // ── task ────────────────────────────────────────────────────────────────────
  { slug: "jira", name: "Jira", layer: "task" },
  { slug: "linear", name: "Linear", layer: "task" },
  { slug: "asana", name: "Asana", layer: "task" },
  { slug: "trello", name: "Trello", layer: "task" },
  { slug: "clickup", name: "ClickUp", layer: "task" },
  // ── docs ────────────────────────────────────────────────────────────────────
  { slug: "confluence", name: "Confluence", layer: "docs" },
  { slug: "notion", name: "Notion", layer: "docs" },
  // ── workspace ───────────────────────────────────────────────────────────────
  { slug: "slack", name: "Slack", layer: "workspace" },
  { slug: "discord", name: "Discord", layer: "workspace" },
  { slug: "mattermost", name: "Mattermost", layer: "workspace" },
  { slug: "gmail", name: "Gmail", layer: "workspace" },
  { slug: "googlechat", name: "Google Chat", layer: "workspace" },
  // ── identity ────────────────────────────────────────────────────────────────
  { slug: "keycloak", name: "Keycloak", layer: "identity", connectorType: "keycloak" },
  { slug: "auth0", name: "Auth0", layer: "identity" },
  { slug: "okta", name: "Okta", layer: "identity" },
  // ── model ───────────────────────────────────────────────────────────────────
  { slug: "anthropic", name: "Anthropic", layer: "model" },
  { slug: "openai", name: "OpenAI", layer: "model" },
  { slug: "ollama", name: "Ollama", layer: "model" },
  { slug: "huggingface", name: "Hugging Face", layer: "model" },
];
