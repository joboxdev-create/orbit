import { Settings } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      description="Workspace and account preferences."
      icon={<Settings size={22} />}
    />
  );
}
