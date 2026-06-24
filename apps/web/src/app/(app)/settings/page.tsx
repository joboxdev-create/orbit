import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";

/** Workspace & account settings. Placeholder for now. */
export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      description="Workspace and account preferences."
      icon={<Settings size={22} />}
    />
  );
}
