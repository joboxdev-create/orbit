import type { LayerKind } from "@orbit/shared";
import {
  Activity,
  Boxes,
  Cloud,
  FileText,
  FlaskConical,
  GitBranch,
  KeyRound,
  type LucideIcon,
  ListChecks,
  Mail,
  Server,
  Sparkles,
} from "lucide-react";

// Generic, non-brand concepts -> Lucide (MIT). Brands live in <BrandIcon>.
const LAYER_ICONS: Record<LayerKind, LucideIcon> = {
  server: Server,
  cloud: Cloud,
  infra: Boxes,
  repository: GitBranch,
  task: ListChecks,
  docs: FileText,
  test: FlaskConical,
  monitoring: Activity,
  email: Mail,
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
