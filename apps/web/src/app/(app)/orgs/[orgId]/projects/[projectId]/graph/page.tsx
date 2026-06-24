import { Network } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

export default function ProjectGraphPage() {
  return (
    <ComingSoon
      title="Project Graph"
      description="Visual map of services, dependencies, and relationships within this project."
      icon={<Network size={22} />}
      note="Populated from connector data once the connector foundation is in place."
    />
  );
}
