import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send } from "lucide-react";
import {
  api,
  type ChatMessage,
  type ConnectorInstance,
  type Conversation,
  type ToolCall,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Project chat session: converse with a model served by one of the project's
 * connected `model` connectors. Persists to the conversation (auto-saved after
 * each turn). MVP — non-streaming, no tools.
 */
export function Chat({
  conversation,
  connectors,
  onSaved,
}: {
  conversation: Conversation | null;
  connectors: ConnectorInstance[];
  onSaved: () => void;
}) {
  const modelConnectors = connectors.filter(
    (c) => c.layer === "model" && c.status === "connected",
  );

  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [instanceId, setInstanceId] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<{
    tc: ToolCall;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Ask the user to approve a mutating tool call; resolves when they decide. */
  function confirmTool(tc: ToolCall): Promise<boolean> {
    return new Promise((resolve) => setPendingTool({ tc, resolve }));
  }

  // Load state from the conversation whenever the session changes.
  useEffect(() => {
    setMessages(conversation?.messages ?? []);
    setInstanceId(
      conversation?.instanceId ?? modelConnectors[0]?.id ?? "",
    );
    setModel(conversation?.model ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Load the selected connector's models (via its list_models capability).
  useEffect(() => {
    if (!instanceId) return;
    let active = true;
    api
      .invoke(instanceId, "list_models", {})
      .then((r) => {
        if (!active) return;
        const names = Array.isArray(r.result)
          ? (r.result as { name: string }[]).map((m) => m.name)
          : [];
        setModels(names);
        setModel((prev) => (prev && names.includes(prev) ? prev : (names[0] ?? "")));
      })
      .catch(() => active && setModels([]));
    return () => {
      active = false;
    };
  }, [instanceId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || !instanceId || !model || busy || !conversation) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    // Use tools when the model provider supports them (currently Anthropic) and
    // the project has connected, non-model connectors to draw tools from.
    const selected = modelConnectors.find((c) => c.id === instanceId);
    const toolCapable =
      selected?.connectorType === "anthropic" ||
      selected?.connectorType === "ollama";
    const hasTools = connectors.some(
      (c) => c.layer !== "model" && c.status === "connected",
    );
    const useTools = toolCapable && hasTools;

    setInput("");
    setBusy(true);
    setError(null);
    try {
      let full: ChatMessage[];
      if (useTools) {
        // Frontend-driven agentic loop: one model turn at a time; auto-run
        // read-only tools, pause for confirmation on mutating ones.
        setMessages(next);
        let convo: ChatMessage[] = [...next];
        const appended: ChatMessage[] = [];
        const render = () => setMessages([...next, ...appended]);
        for (let step = 0; step < 8; step++) {
          const turn = await api.chatTurnStream(
            instanceId,
            { model, messages: convo },
            (acc) =>
              setMessages([
                ...next,
                ...appended,
                { role: "assistant", content: acc },
              ]),
          );
          const assistant: ChatMessage = {
            role: "assistant",
            content: turn.content,
            ...(turn.toolCalls.length ? { toolCalls: turn.toolCalls } : {}),
          };
          convo = [...convo, assistant];
          appended.push(assistant);
          render();
          if (!turn.toolCalls.length) break;

          for (const tc of turn.toolCalls) {
            let resultText: string;
            if (tc.readOnly === false && !(await confirmTool(tc))) {
              resultText = "Tool call rejected by the user.";
            } else {
              try {
                const r = await api.runTool(instanceId, tc.name, tc.input);
                resultText = JSON.stringify(r.result);
              } catch (e) {
                resultText = `Error: ${(e as Error).message}`;
              }
            }
            const toolMsg: ChatMessage = {
              role: "tool",
              content: resultText,
              toolCallId: tc.id,
              toolName: tc.name,
            };
            convo = [...convo, toolMsg];
            appended.push(toolMsg);
            render();
          }
        }
        full = [...next, ...appended];
        setMessages(full);
      } else {
        setMessages([...next, { role: "assistant", content: "" }]);
        const content = await api.chatStream(
          instanceId,
          { model, messages: next },
          (acc) => setMessages([...next, { role: "assistant", content: acc }]),
        );
        full = [...next, { role: "assistant", content }];
        setMessages(full);
      }
      // Auto-save (best-effort): persist messages + the chosen model, and name
      // a still-untitled session after its first user message.
      const firstUser = full.find((m) => m.role === "user")?.content;
      const title =
        conversation.title === "New chat" && firstUser
          ? firstUser.slice(0, 48)
          : undefined;
      void api
        .updateConversation(conversation.id, {
          messages: full,
          instanceId,
          model,
          ...(title ? { title } : {}),
        })
        .then(onSaved)
        .catch(() => {});
    } catch (e) {
      setError((e as Error).message);
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  if (!conversation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Bot size={28} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No chat selected.</p>
          <p className="text-xs text-muted-foreground">
            Use <span className="font-medium text-foreground">+</span> next to
            “Chat” in the sidebar to start one.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (modelConnectors.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Bot size={28} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No model connected in this project.
          </p>
          <p className="text-xs text-muted-foreground">
            Connect a <span className="font-medium text-foreground">model</span>{" "}
            connector (Ollama, Anthropic…) to chat.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col gap-3">
      {/* Top bar: mode + model */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="agent" disabled>
              Agent (soon)
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1.5">
          {modelConnectors.length > 1 && (
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Connector" />
              </SelectTrigger>
              <SelectContent>
                {modelConnectors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={model}
            onValueChange={setModel}
            disabled={!models.length}
          >
            <SelectTrigger className="h-7 w-48 text-xs">
              <SelectValue placeholder={models.length ? "Model" : "No models"} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages — directly on the background, no card */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-1 py-2"
      >
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            Ask anything to start the conversation.
          </p>
        )}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                  {m.content}
                </div>
              </div>
            );
          }
          if (m.role === "tool") {
            // A tool result — collapsed by default.
            return (
              <details key={i} className="px-1 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">
                  🔧 {m.toolName} — result
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px]">
                  {m.content}
                </pre>
              </details>
            );
          }
          // Assistant: flowing text on the background; tool calls shown as steps.
          return (
            <div key={i} className="space-y-1 px-1">
              {m.content && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.content}
                </div>
              )}
              {m.toolCalls?.map((tc) => (
                <div
                  key={tc.id}
                  className="truncate font-mono text-xs text-muted-foreground"
                >
                  🔧 {tc.name}({JSON.stringify(tc.input)})
                </div>
              ))}
            </div>
          );
        })}
        {busy &&
          !pendingTool &&
          (messages[messages.length - 1]?.role !== "assistant" ||
            messages[messages.length - 1]?.content === "") && (
            <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Bot size={14} className="animate-pulse" />
              Thinking…
            </div>
          )}
      </div>

      {pendingTool && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">
            The assistant wants to run a tool that makes changes:
          </p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {pendingTool.tc.name}({JSON.stringify(pendingTool.tc.input)})
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                pendingTool.resolve(false);
                setPendingTool(null);
              }}
            >
              Deny
            </Button>
            <Button
              size="sm"
              onClick={() => {
                pendingTool.resolve(true);
                setPendingTool(null);
              }}
            >
              Allow
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Composer — text on top, toolbar below (submit left, tools right) */}
      <div className="rounded-xl border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={model ? `Message ${model}…` : "Select a model to start…"}
          className="w-full resize-none bg-transparent px-3 pb-1 pt-3 text-sm focus-visible:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {/* Options (placeholders, coming soon) */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled
              className="size-8 text-muted-foreground"
              title="Add context (coming soon)"
            >
              <Plus size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled
              className="size-8 font-mono text-muted-foreground"
              title="Commands (coming soon)"
            >
              /
            </Button>
          </div>

          <Button
            size="icon"
            onClick={send}
            disabled={busy || !input.trim() || !model}
            className="size-8 shrink-0"
            aria-label="Send"
          >
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
