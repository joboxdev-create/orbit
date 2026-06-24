import {
  siAmazonwebservices,
  siAnsible,
  siAnthropic,
  siArgo,
  siAsana,
  siAuth0,
  siBitbucket,
  siCircleci,
  siClickup,
  siCloudflare,
  siConfluence,
  siDatadog,
  siDependabot,
  siDigitalocean,
  siDiscord,
  siDocker,
  siElasticsearch,
  siGithub,
  siGithubactions,
  siGitlab,
  siGmail,
  siGooglechat,
  siGooglecloud,
  siGrafana,
  siHelm,
  siHetzner,
  siHuggingface,
  siJenkins,
  siJira,
  siKeycloak,
  siKubernetes,
  siLinear,
  siMariadb,
  siMattermost,
  siMongodb,
  siMysql,
  siNetlify,
  siNewrelic,
  siNomad,
  siNotion,
  siOkta,
  siOllama,
  siOpenai,
  siOpsgenie,
  siOvh,
  siPagerduty,
  siPostgresql,
  siPrometheus,
  siProxmox,
  siPulumi,
  siRedis,
  siSentry,
  siSlack,
  siSnyk,
  siSonarqube,
  siTerraform,
  siTrello,
  siTrivy,
  siVault,
  siVercel,
} from "simple-icons";
import { Plug } from "lucide-react";

interface SimpleIcon {
  title: string;
  hex: string;
  path: string;
}

// Real brand logos via Simple Icons. Individual imports keep the bundle to the
// icons we reference (the connector catalogue), not the whole Simple Icons set.
// Keyed by the slug used as <BrandIcon slug="…" />.
const BRAND_ICONS: Record<string, SimpleIcon> = {
  amazonwebservices: siAmazonwebservices,
  ansible: siAnsible,
  anthropic: siAnthropic,
  argo: siArgo,
  asana: siAsana,
  auth0: siAuth0,
  bitbucket: siBitbucket,
  circleci: siCircleci,
  clickup: siClickup,
  cloudflare: siCloudflare,
  confluence: siConfluence,
  datadog: siDatadog,
  dependabot: siDependabot,
  digitalocean: siDigitalocean,
  discord: siDiscord,
  docker: siDocker,
  elasticsearch: siElasticsearch,
  github: siGithub,
  githubactions: siGithubactions,
  gitlab: siGitlab,
  gmail: siGmail,
  googlechat: siGooglechat,
  googlecloud: siGooglecloud,
  grafana: siGrafana,
  helm: siHelm,
  hetzner: siHetzner,
  huggingface: siHuggingface,
  jenkins: siJenkins,
  jira: siJira,
  keycloak: siKeycloak,
  kubernetes: siKubernetes,
  linear: siLinear,
  mariadb: siMariadb,
  mattermost: siMattermost,
  mongodb: siMongodb,
  mysql: siMysql,
  netlify: siNetlify,
  newrelic: siNewrelic,
  nomad: siNomad,
  notion: siNotion,
  okta: siOkta,
  ollama: siOllama,
  openai: siOpenai,
  opsgenie: siOpsgenie,
  ovh: siOvh,
  pagerduty: siPagerduty,
  postgresql: siPostgresql,
  prometheus: siPrometheus,
  proxmox: siProxmox,
  pulumi: siPulumi,
  redis: siRedis,
  sentry: siSentry,
  slack: siSlack,
  snyk: siSnyk,
  sonarqube: siSonarqube,
  terraform: siTerraform,
  trello: siTrello,
  trivy: siTrivy,
  vault: siVault,
  vercel: siVercel,
};

// On the dark UI, near-black brand marks (e.g. GitHub #181717) would vanish.
// Lift only those to the theme foreground; keep colored brands in brand color.
function pickFill(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.25 ? "#e6e9ef" : `#${hex}`;
}

export function BrandIcon({
  slug,
  size = 28,
}: {
  slug?: string | null;
  size?: number;
}) {
  const icon = slug ? BRAND_ICONS[slug] : undefined;
  if (!icon) {
    // Unknown/missing brand: neutral fallback.
    return <Plug size={size} aria-hidden />;
  }
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={pickFill(icon.hex)}
    >
      <path d={icon.path} />
    </svg>
  );
}
