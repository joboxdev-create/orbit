import { MessagesSquare } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

export default function ProjectChatPage() {
  return (
    <ComingSoon
      title="Project Chat"
      description="Ask questions about this project's infrastructure, connected services, and history."
      icon={<MessagesSquare size={22} />}
      note="Context-aware chat scoped to this project's connectors comes after the connector foundation is complete."
    />
  );
}
