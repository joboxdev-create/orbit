import { Network } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

export default function GraphPage() {
  return (
    <ComingSoon
      title="Graph"
      description="Visual map of your infrastructure and service relationships."
      icon={<Network size={22} />}
      note="The graph will be populated from connected services once the connector foundation is in place."
    />
  );
}
