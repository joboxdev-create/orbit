import type { LayerKind } from "@orbit/shared";
import {
  Activity,
  Cloud,
  Container,
  Database,
  FileCode,
  FileText,
  GitBranch,
  KeyRound,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

// Generic, non-brand concepts -> Lucide (MIT). Brands live in <BrandIcon>.
const LAYER_ICONS: Record<LayerKind, LucideIcon> = {
  repository: GitBranch,
  cicd: Workflow,
  hosting: Cloud,
  orchestration: Container,
  iac: FileCode,
  database: Database,
  observability: Activity,
  security: ShieldCheck,
  task: ListChecks,
  docs: FileText,
  workspace: LayoutGrid,
  identity: KeyRound,
  model: Sparkles,
};

export function LayerIcon({
  kind,
  size = 20,
}: {
  kind: LayerKind;
  size?: number;
}) {
  const Icon = LAYER_ICONS[kind];
  return <Icon size={size} aria-hidden />;
}
