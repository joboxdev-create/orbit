import { MessagesSquare } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

/**
 * AI chat over the whole infrastructure. Placeholder for now: the AI layer is
 * deliberately built last, on top of the connectors already mapped.
 */
export default function ChatPage() {
  return (
    <ComingSoon
      title="Chat"
      description="Talk to ORBIT about your whole infrastructure."
      icon={<MessagesSquare size={22} />}
      note="The AI assistant comes after the connector foundation is solid. It will answer over your projects, layers and connected services."
    />
  );
}
