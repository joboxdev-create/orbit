import { MessagesSquare } from "lucide-react";
import { ComingSoon } from "@/common/app-shell/coming-soon";

export default function ChatPage() {
  return (
    <ComingSoon
      title="Chat"
      description="Talk to ORBIT about your whole infrastructure."
      icon={<MessagesSquare size={22} />}
      note="The AI assistant comes after the connector foundation is solid. It will answer across your projects, layers, and connected services."
    />
  );
}
